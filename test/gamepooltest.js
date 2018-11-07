var GamePoolTestProxy = artifacts.require("./GamePoolTestProxy.sol");

function getBalance(account) {
	return new Promise(function (resolve, reject) {
		web3.eth.getBalance(account, "latest", function (error, result) {
			if (error) {
				reject(error);
			} else {
				resolve(web3.toBigNumber(result));
			}
		});
	});
}

async function createNewTestGame(accounts) {
	let game = await GamePoolTestProxy.deployed();
	await game.forceToCloseAllGames();
	
	var openingTime = Math.floor(Date.now() / 1000);
	var duration = 600;
	
	await game.createNewGame(openingTime
		, duration
		, "BTC"
		, "LTC"
		, "BCC"
		, "ETH"
		, "ETC"
		, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
		, 10
		, 20
		, 5
		, web3.toWei("10", "finney")
		, {from: accounts[0]});
}

contract('GamePoolTestProxy', function(accounts) {
	
	it("Initial Data", async function () {
		let game = await GamePoolTestProxy.deployed();
		
		let numberOfGames = await game.numberOfGames.call();
		assert.equal(numberOfGames, 0);
		
		let txFeeReceiver = await game.txFeeReceiver.call();
		assert.equal(txFeeReceiver, accounts[0]);
		
		let oraclizeFee = await game.oraclizeFee.call();
		assert.equal(oraclizeFee, 0);
		
		let ORICALIZE_GAS_LIMIT = await game.ORICALIZE_GAS_LIMIT.call();
		assert.equal(ORICALIZE_GAS_LIMIT, 150000);
		
		// Test MIN_BET and HIDDEN_TIME_BEFORE_CLOSE.
		let MIN_BET = await game.MIN_BET.call();
		assert.ok(MIN_BET.eq(web3.toWei("10", "finney")));
		
		let HIDDEN_TIME_BEFORE_CLOSE = await game.HIDDEN_TIME_BEFORE_CLOSE.call();
		assert.equal(HIDDEN_TIME_BEFORE_CLOSE, 300);
	});
	
	it("Send & withdraw oraclize fee", async function () {
		let game = await GamePoolTestProxy.deployed();
		
		await game.sendTransaction({from: accounts[0], value: web3.toWei("1", "gwei")});
		await game.sendOraclizeFee({from: accounts[0], value: web3.toWei("1", "gwei")});
		
		let oraclizeFee = await game.oraclizeFee.call();
		assert.equal(oraclizeFee, web3.toWei("2", "gwei"));
		
		let balance = await getBalance(game.address);
		assert.equal(balance, web3.toWei("2", "gwei"));
		
		let balanceBefore = await getBalance(accounts[0]);
		await game.withdrawOraclizeFee({from: accounts[0]});
		
		let balanceAfter = await getBalance(accounts[0]);
		assert.equal(balanceAfter.sub(balanceBefore), web3.toWei("2", "gwei"));
		
		oraclizeFee = await game.oraclizeFee.call();
		assert.equal(oraclizeFee, 0);
		
		balance = await getBalance(game.address);
		assert.equal(balance, 0);
	});
	
	it("Create game", async function () {
		await createNewTestGame(accounts);
		
		let game = await GamePoolTestProxy.deployed();
		
		let numberOfGames = await game.numberOfGames.call();
		assert.equal(numberOfGames, 1);
		
		let gameData = await game.games.call(0);
		assert.equal(gameData.length, 13);
		
		// Game id.
		assert.equal(gameData[0], 0);
		
		// Test opening time,  duration and closing time.
		let openingTime = gameData[1];
		let closingTime = gameData[2];
		let duration = gameData[3];
		
		assert.equal(duration, 600);
		assert.ok(closingTime.eq(openingTime.add(duration).sub(1)));
		
		// Hidden time
		assert.equal(gameData[4], 300);
		
		// Claimed award time.
		assert.equal(gameData[5], 2592000);
		
		// Y, A, B, tx fee
		assert.equal(gameData[6], 0);
		assert.equal(gameData[7], 10);
		assert.equal(gameData[8], 20);
		assert.equal(gameData[9], 5);
		
		// Is finished, is y choosed.
		assert.equal(gameData[10], false);
		assert.equal(gameData[11], false);
		
		// Minimum difference bets.
		assert.equal(gameData[12], web3.toWei("10", "finney"));	

		// Test Y Distributions.
		let yDist = await game.gameYDistribution.call(0);
		assert.equal(yDist.length, 50);
		for (let i = 0; i < 50; ++i) {
			assert.equal(yDist[i], (i % 10) + 1);
		}
		
		// Test coins.
		for (let i = 0; i < 5; ++i) {
			let coin = await game.gameCoinData.call(0, i);
			assert.equal(coin.length, 5);
			
			// name
			if (0 == i) {
				assert.equal(coin[0], "BTC");
			} else if (1 == i) {
				assert.equal(coin[0], "LTC");
			} else if (2 == i) {
				assert.equal(coin[0], "BCC");
			} else if (3 == i) {
				assert.equal(coin[0], "ETH");
			} else {
				assert.equal(coin[0], "ETC");
			}
			
			assert.equal(coin[1], 0); 	   // startExRate
			assert.equal(coin[2], 0); 	   // timeStampOfStartExRate
			assert.equal(coin[3], 0); 	   // endExRate
			assert.equal(coin[4], 0); 	   // timeStampOfEndExRate	
		}
		
		// getCoinBetData;
		for (let i = 0; i < 5; ++i) {
			let coinbets = await game.gameBetData.call(0, i);
			assert.ok(coinbets[0].isZero()); // totalBets
			assert.ok(coinbets[1].isZero()); // largestBets
			assert.ok(coinbets[2].isZero()); // numberOfBets
		}
		
		// Test winner mask.
		let numberOfWinnerIds = await game.gameNumberOfWinnerCoinIds(0);
		assert.equal(numberOfWinnerIds, 0);		
	});
	
	it("Game State", async function () {
		let game = await GamePoolTestProxy.deployed();
		
		let numberOfGames = await game.numberOfGames.call();
		assert.ok(numberOfGames > 0);
		
		let gameId = numberOfGames.sub(1);
		
		let now = Math.floor(Date.now() / 1000);
		
		await game.setOpenCloseTime(gameId, now + 300, now + 600);
		let gameState = await game.gameState(gameId);
		assert.equal(gameState, 1); // Created
		
		await game.setStartExRate(gameId, [10000, 20000, 30000, 50, 4000]);
		gameState = await game.gameState(gameId);
		assert.equal(gameState, 2); // Ready
		
		await game.setOpenCloseTime(gameId, now - 300, now + 300);
		gameState = await game.gameState(gameId);
		assert.equal(gameState, 3); // Open
		
		await game.setOpenCloseTime(gameId, now - 600, now - 300);
		gameState = await game.gameState(gameId);
		assert.equal(gameState, 4); // Stop
		
		await game.setEndExRate(gameId, [10000, 20000, 30000, 50, 4000]);
		await game.setY(gameId, 20);
		gameState = await game.gameState(gameId);
		assert.equal(gameState, 5); // WaitToClose
			
		await game.setIsFinished(gameId, true);
		gameState = await game.gameState(gameId);
		assert.equal(gameState, 6); // Closed
		
		await game.setStartExRate(gameId, [0, 0, 0, 0, 0]);
		await game.setIsFinished(gameId, false);
		gameState = await game.gameState(gameId);
		assert.equal(gameState, 7); // Error
		
		gameState = await game.gameState(numberOfGames);
		assert.equal(gameState, 0); // Not exists
	});
});

contract('GamePoolTestProxy', function(accounts) {
	this.startExRate = [100, 200, 300, 400, 500];
	this.threshold = web3.toBigNumber(web3.toWei("10", "finney"));
	
	beforeEach(async function() {
		await createNewTestGame(accounts);
		
		let game = await GamePoolTestProxy.deployed();
		let numberOfGames = await game.numberOfGames.call();
		
		await game.setStartExRate(numberOfGames - 1, startExRate);
	});
	
	it("Take bets", async function () {
		let game = await GamePoolTestProxy.deployed();
		
		// Test is closed.
		let numberOfGames = await game.numberOfGames.call();
		assert.ok(numberOfGames > 0);
		
		let gameId = numberOfGames - 1;
		
		// First bet.
		await game.bet(gameId, 0, {value: web3.toWei(10, "finney"), from: accounts[1]});
			
		let netBets0 = web3.toBigNumber(web3.toWei("9950", "microether"));
		let coinbets = await game.gameBetData.call(gameId, 0);
		assert.ok(coinbets[0].eq(netBets0)); // totalBets
		assert.ok(coinbets[1].eq(netBets0)); // largestBets
		assert.ok(coinbets[2].eq(1));        // numberOfBets
		
		// Same largest bet on same coin.
		await game.bet(gameId, 0, {value: web3.toWei(10, "finney"), from: accounts[2]});
			
		coinbets = await game.gameBetData.call(gameId, 0);
		assert.ok(coinbets[0].eq(netBets0.add(netBets0))); // totalBets
		assert.ok(coinbets[1].eq(netBets0)); // largestBets
		assert.ok(coinbets[2].eq(2));       // numberOfBets
		
		// Another bigger bet on same coin.
		await game.bet(gameId, 0, {value: web3.toWei(100, "finney"), from: accounts[3]});
			
		let netBets1 = web3.toBigNumber(web3.toWei("99500", "microether"));
		coinbets = await game.gameBetData.call(gameId, 0);
		assert.ok(coinbets[0].eq(netBets1.add(netBets0).add(netBets0))); // totalBets
		assert.ok(coinbets[1].eq(netBets1)); // largestBets
		assert.ok(coinbets[2].eq(3));        // numberOfBets
		
		// Change bet to another coins
		await game.bet(gameId, 1, {value: web3.toWei(100, "finney"), from: accounts[4]});
			
		coinbets = await game.gameBetData.call(gameId, 1);
		assert.ok(coinbets[0].eq(netBets1)); // totalBets
		assert.ok(coinbets[1].eq(netBets1)); // largestBets
		assert.ok(coinbets[2].eq(1));        // numberOfBets
	});
	
	it("Game - Largest rasing coin, sole winner, two highest bets", async function () {
		let game = await GamePoolTestProxy.deployed();
		
		// Test is closed.
		let numberOfGames = await game.numberOfGames.call();
		assert.ok(numberOfGames > 0);
		
		let gameId = numberOfGames - 1;
		
		// Bets.
		await game.bet(gameId, 0, {value: web3.toWei(30, "finney"), from: accounts[7]});
		await game.bet(gameId, 0, {value: web3.toWei(30, "finney"), from: accounts[8]});
		await game.bet(gameId, 0, {value: web3.toWei(10, "finney"), from: accounts[9]});
		await game.bet(gameId, 1, {value: web3.toWei(10, "finney"), from: accounts[1]});
		await game.bet(gameId, 2, {value: web3.toWei(10, "finney"), from: accounts[2]});
		await game.bet(gameId, 3, {value: web3.toWei(10, "finney"), from: accounts[3]});
		
		// Close the game.
		let endExRate = [200 // 100%
			, 220 // 10%
			, 300 // 0%
			, 360 // -10%
			, 600]; // 20%
		await game.setEndExRate(gameId, endExRate);
		await game.setY(gameId, 10);
		await game.close(gameId, {from: accounts[0], gasLimit: 371211});
		
		// Test the coin result.
		for (let i = 0; i < 5; ++i) {
			let coin = await game.gameCoinData.call(gameId, i);
			assert.equal(coin[1], startExRate[i]); // startExRate
			assert.ok(coin[2] != 0);                    // timeStampOfStartExRate
			assert.equal(coin[3], endExRate[i]);   // endExRate
			assert.ok(coin[4] != 0);                    // timeStampOfEndExRate
		}
		
		// Test the game state.
		let gameState = await game.gameState.call(gameId);
		assert.equal(gameState, 6); // Close state.
		
		// Test the winners.
		let numberOfWinnerCoinIds = await game.gameNumberOfWinnerCoinIds.call(gameId);
		assert.ok(numberOfWinnerCoinIds.eq(1));
		
		let winnerId = await game.gameWinnerCoinIds.call(gameId, 0);
		assert.ok(winnerId.eq(0));
		
		// Calculate awards.
		let gameData = await game.games.call(gameId);
		
		let A = gameData[7];
		let B = gameData[8];
		
		let oneHundred = web3.toBigNumber("100");
		
		let totalAwards = web3.toBigNumber(web3.toWei(99500, "microether"));
		
		let bet0 = web3.toBigNumber(web3.toWei(29850, "microether")); 
		let bet1 = web3.toBigNumber(web3.toWei(29850, "microether"));
		let bet2 = web3.toBigNumber(web3.toWei(9950, "microether")); 
		
		let awardsOfB = totalAwards.mul(B).dividedToIntegerBy(oneHundred);
		
		let awards0 = totalAwards.mul(A).div(oneHundred);
		let awards1 = awardsOfB.mul(bet1).dividedToIntegerBy(bet1.add(bet2));
		let awards2 = awardsOfB.mul(bet2).dividedToIntegerBy(bet1.add(bet2));
		
		let highestAwards = totalAwards.sub(awards0).sub(awardsOfB).dividedToIntegerBy(web3.toBigNumber("2"));
		awards0 = awards0.add(highestAwards);
		awards1 = awards1.add(highestAwards);
		
		let awardsFromContract0 = await game.calculateAwardAmount(gameId, {from: accounts[7]});
		let awardsFromContract1 = await game.calculateAwardAmount(gameId, {from: accounts[8]});
		let awardsFromContract2 = await game.calculateAwardAmount(gameId, {from: accounts[9]});
		
		console.log(awardsFromContract0.toString());
		
		assert.ok(awardsFromContract0.eq(awards0));
		assert.ok(awardsFromContract1.eq(awards1));
		assert.ok(awardsFromContract2.eq(awards2));
		
		// Get balance at beginning.
		let balanceBegin0 = await getBalance(accounts[7]);
		let balanceBegin1 = await getBalance(accounts[8]);
		let balanceBegin2 = await getBalance(accounts[9]);
		
		// Withdraw.
		await game.getAwards(gameId, {from: accounts[7]});
		await game.getAwards(gameId, {from: accounts[8]});
		await game.getAwards(gameId, {from: accounts[9]});
		
		// Get balance at ending. 
		let balanceFinal0 = await getBalance(accounts[7]);
		let balanceFinal1 = await getBalance(accounts[8]);
		let balanceFinal2 = await getBalance(accounts[9]);
		
		assert.ok(balanceBegin0.add(awards0).sub(balanceFinal0).lte(threshold));
		assert.ok(balanceBegin1.add(awards1).sub(balanceFinal1).lte(threshold));
		assert.ok(balanceBegin2.add(awards2).sub(balanceFinal2).lte(threshold));
	});
	
	it("Game - Largest rasing coin, sole winner, two highest bets, force Y = 0", async function () {
		let game = await GamePoolTestProxy.deployed();
		
		// Test is closed.
		let numberOfGames = await game.numberOfGames.call();
		assert.ok(numberOfGames > 0);
		
		let gameId = numberOfGames - 1;
		
		// Bets.
		await game.bet(gameId, 0, {value: web3.toWei(30, "finney"), from: accounts[7]});
		await game.bet(gameId, 0, {value: web3.toWei(30, "finney"), from: accounts[8]});
		await game.bet(gameId, 0, {value: web3.toWei(10, "finney"), from: accounts[9]});
		await game.bet(gameId, 1, {value: web3.toWei(10, "finney"), from: accounts[1]});
		await game.bet(gameId, 2, {value: web3.toWei(10, "finney"), from: accounts[2]});
		await game.bet(gameId, 3, {value: web3.toWei(10, "finney"), from: accounts[3]});
		
		// Set Y to zero.
		await game.setY(gameId, 0);
		
		// Close the game.
		let endExRate = [200 // 100%
			, 220 // 10%
			, 300 // 0%
			, 360 // -10%
			, 600]; // 20%
		await game.setEndExRate(gameId, endExRate);
		
		await game.close(gameId, {from: accounts[0], gasLimit: 371211});
		
		// Test the coin result.
		for (let i = 0; i < 5; ++i) {
			let coin = await game.gameCoinData.call(gameId, i);
			assert.equal(coin[1], startExRate[i]); // startExRate
			assert.ok(coin[2] != 0);               // timeStampOfStartExRate
			assert.equal(coin[3], endExRate[i]);   // endExRate
			assert.ok(coin[4] != 0);               // timeStampOfEndExRate
		}
		
		// Test the game state.
		let gameState = await game.gameState.call(gameId);
		assert.equal(gameState, 6); // Close state.
		
		// Test the winners.
		let numberOfWinnerCoinIds = await game.gameNumberOfWinnerCoinIds.call(gameId);
		assert.ok(numberOfWinnerCoinIds.eq(1));
		
		let winnerId = await game.gameWinnerCoinIds.call(gameId, 0);
		assert.ok(winnerId.eq(0));
		
		// Calculate awards.
		let gameData = await game.games.call(gameId);
		
		let A = gameData[7];
		let B = gameData[8];
		
		let oneHundred = web3.toBigNumber("100");
		
		let totalAwards = web3.toBigNumber(web3.toWei(99500, "microether"));
		
		let bet0 = web3.toBigNumber(web3.toWei(29850, "microether")); 
		let bet1 = web3.toBigNumber(web3.toWei(29850, "microether"));
		let bet2 = web3.toBigNumber(web3.toWei(9950, "microether")); 
		
		let awardsOfB = totalAwards.mul(B).dividedToIntegerBy(oneHundred);
		
		let awards0 = awardsOfB.mul(bet0).dividedToIntegerBy(bet0.add(bet1).add(bet2));
		let awards1 = awardsOfB.mul(bet1).dividedToIntegerBy(bet0.add(bet1).add(bet2));
		let awards2 = awardsOfB.mul(bet2).dividedToIntegerBy(bet0.add(bet1).add(bet2));
		
		let highestAwards = totalAwards.sub(awardsOfB).dividedToIntegerBy(web3.toBigNumber("2"));
		awards0 = awards0.add(highestAwards);
		awards1 = awards1.add(highestAwards);
		
		let awardsFromContract0 = await game.calculateAwardAmount(gameId, {from: accounts[7]});
		let awardsFromContract1 = await game.calculateAwardAmount(gameId, {from: accounts[8]});
		let awardsFromContract2 = await game.calculateAwardAmount(gameId, {from: accounts[9]});
		
		assert.ok(awardsFromContract0.eq(awards0));
		assert.ok(awardsFromContract1.eq(awards1));
		assert.ok(awardsFromContract2.eq(awards2));
		
		// Get balance at beginning.
		let balanceBegin0 = await getBalance(accounts[7]);
		let balanceBegin1 = await getBalance(accounts[8]);
		let balanceBegin2 = await getBalance(accounts[9]);
		
		// Withdraw.
		await game.getAwards(gameId, {from: accounts[7]});
		await game.getAwards(gameId, {from: accounts[8]});
		await game.getAwards(gameId, {from: accounts[9]});
		
		// Get balance at ending. 
		let balanceFinal0 = await getBalance(accounts[7]);
		let balanceFinal1 = await getBalance(accounts[8]);
		let balanceFinal2 = await getBalance(accounts[9]);
		
		assert.ok(balanceBegin0.add(awards0).sub(balanceFinal0).lte(threshold));
		assert.ok(balanceBegin1.add(awards1).sub(balanceFinal1).lte(threshold));
		assert.ok(balanceBegin2.add(awards2).sub(balanceFinal2).lte(threshold));
	});
	
	it("Game - Smallest rasing coin, sole winner, one highest bets", async function () {
		let game = await GamePoolTestProxy.deployed();
		
		// Test is closed.
		let numberOfGames = await game.numberOfGames.call();
		assert.ok(numberOfGames > 0);
		
		let gameId = numberOfGames - 1;
		
		// Bets.
		await game.bet(gameId, 0, {value: web3.toWei(30, "finney"), from: accounts[7]});
		await game.bet(gameId, 0, {value: web3.toWei(20, "finney"), from: accounts[8]});
		await game.bet(gameId, 0, {value: web3.toWei(10, "finney"), from: accounts[9]});
		await game.bet(gameId, 1, {value: web3.toWei(10, "finney"), from: accounts[1]});
		await game.bet(gameId, 2, {value: web3.toWei(10, "finney"), from: accounts[2]});
		await game.bet(gameId, 3, {value: web3.toWei(10, "finney"), from: accounts[3]});
		await game.bet(gameId, 4, {value: web3.toWei(10, "finney"), from: accounts[4]});
		
		// Close the game.
		let endExRate = [50 // -50%
			, 220 // 10%
			, 300 // 0%
			, 360 // -10%
			, 600]; // 20%
		await game.setEndExRate(gameId, endExRate);
		await game.setY(gameId, 10);
		await game.close(gameId, {from: accounts[0], gasLimit: 371211});
		
		// Test the coin result.
		for (let i = 0; i < 5; ++i) {
			let coin = await game.gameCoinData.call(gameId, i);
			assert.equal(coin[1], startExRate[i]); // startExRate
			assert.ok(coin[2] != 0);               // timeStampOfStartExRate
			assert.equal(coin[3], endExRate[i]);   // endExRate
			assert.ok(coin[4] != 0);               // timeStampOfEndExRate
		}

		// Test the game state.
		let gameState = await game.gameState.call(gameId);
		assert.equal(gameState, 6); // Close state.
		
		// Test the winners.
		let numberOfWinnerCoinIds = await game.gameNumberOfWinnerCoinIds.call(gameId);
		assert.ok(numberOfWinnerCoinIds.eq(1));
		
		let winnerId = await game.gameWinnerCoinIds.call(gameId, 0);
		assert.ok(winnerId.eq(0));

		// Calculate awards.
		let gameData = await game.games.call(gameId);
		
		let A = gameData[7];
		let B = gameData[8];
		
		let oneHundred = web3.toBigNumber("100");
		
		let totalAwards = web3.toBigNumber(web3.toWei(99500, "microether"));
		
		let bet0 = web3.toBigNumber(web3.toWei(29850, "microether")); 
		let bet1 = web3.toBigNumber(web3.toWei(19900, "microether"));
		let bet2 = web3.toBigNumber(web3.toWei(9950, "microether")); 
		
		let awardsOfB = totalAwards.mul(B).dividedToIntegerBy(oneHundred);
		
		let awards0 = totalAwards.mul(A).dividedToIntegerBy(oneHundred);
		let awards1 = awardsOfB.mul(bet1).dividedToIntegerBy(bet1.add(bet2));
		let awards2 = awardsOfB.mul(bet2).dividedToIntegerBy(bet1.add(bet2));
		
		let highestAwards = totalAwards.sub(awards0).sub(awardsOfB);
		awards0 = awards0.add(highestAwards);
		
		let awardsFromContract0 = await game.calculateAwardAmount(gameId, {from: accounts[7]});
		let awardsFromContract1 = await game.calculateAwardAmount(gameId, {from: accounts[8]});
		let awardsFromContract2 = await game.calculateAwardAmount(gameId, {from: accounts[9]});
		
		assert.ok(awardsFromContract0.eq(awards0));
		assert.ok(awardsFromContract1.eq(awards1));
		assert.ok(awardsFromContract2.eq(awards2));
		
		// Get balance at beginning.
		let balanceBegin0 = await getBalance(accounts[7]);
		let balanceBegin1 = await getBalance(accounts[8]);
		let balanceBegin2 = await getBalance(accounts[9]);
		
		// Withdraw.
		await game.getAwards(gameId, {from: accounts[7]});
		await game.getAwards(gameId, {from: accounts[8]});
		await game.getAwards(gameId, {from: accounts[9]});
		
		// Get balance at ending. 
		let balanceFinal0 = await getBalance(accounts[7]);
		let balanceFinal1 = await getBalance(accounts[8]);
		let balanceFinal2 = await getBalance(accounts[9]);
		
		assert.ok(balanceBegin0.add(awards0).sub(balanceFinal0).lte(threshold));
		assert.ok(balanceBegin1.add(awards1).sub(balanceFinal1).lte(threshold));
		assert.ok(balanceBegin2.add(awards2).sub(balanceFinal2).lte(threshold));
	});
	
	it("Game - Tied on highest and smallest change rate, sole winner, one highest bets", async function () {
		let game = await GamePoolTestProxy.deployed();
		
		// Test is closed.
		let numberOfGames = await game.numberOfGames.call();
		assert.ok(numberOfGames > 0);
		
		let gameId = numberOfGames - 1;
		
		// Bets.
		await game.bet(gameId, 0, {value: web3.toWei(30, "finney"), from: accounts[7]});
		await game.bet(gameId, 0, {value: web3.toWei(20, "finney"), from: accounts[8]});
		await game.bet(gameId, 0, {value: web3.toWei(10, "finney"), from: accounts[9]});
		await game.bet(gameId, 1, {value: web3.toWei(10, "finney"), from: accounts[1]});
		await game.bet(gameId, 2, {value: web3.toWei(10, "finney"), from: accounts[2]});
		await game.bet(gameId, 3, {value: web3.toWei(10, "finney"), from: accounts[3]});
		await game.bet(gameId, 4, {value: web3.toWei(10, "finney"), from: accounts[4]});
		
		// Close the game.
		let endExRate = [100 // 0%
			, 220 // 10%
			, 300 // 0%
			, 360 // -10%
			, 600]; // 20%
		await game.setEndExRate(gameId, endExRate);
		await game.setY(gameId, 10);
		await game.close(gameId, {from: accounts[0], gasLimit: 371211});
		
		// Test the coin result.
		for (let i = 0; i < 5; ++i) {
			let coin = await game.gameCoinData.call(gameId, i);
			assert.equal(coin[1], startExRate[i]); // startExRate
			assert.ok(coin[2] != 0);               // timeStampOfStartExRate
			assert.equal(coin[3], endExRate[i]);   // endExRate
			assert.ok(coin[4] != 0);               // timeStampOfEndExRate
		}

		// Test the game state.
		let gameState = await game.gameState.call(gameId);
		assert.equal(gameState, 6); // Close state.
		
		// Test the winners.
		let numberOfWinnerCoinIds = await game.gameNumberOfWinnerCoinIds.call(gameId);
		assert.ok(numberOfWinnerCoinIds.eq(1));
		
		let winnerId = await game.gameWinnerCoinIds.call(gameId, 0);
		assert.ok(winnerId.eq(0));
		
		// Calculate awards.
		let gameData = await game.games.call(gameId);
		
		let A = gameData[7];
		let B = gameData[8];
		
		let oneHundred = web3.toBigNumber("100");
		
		let totalAwards = web3.toBigNumber(web3.toWei(99500, "microether"));
		
		let bet0 = web3.toBigNumber(web3.toWei(29850, "microether")); 
		let bet1 = web3.toBigNumber(web3.toWei(19900, "microether"));
		let bet2 = web3.toBigNumber(web3.toWei(9950, "microether")); 
		
		let awardsOfB = totalAwards.mul(B).dividedToIntegerBy(oneHundred);
			
		let awards0 = totalAwards.mul(A).dividedToIntegerBy(oneHundred);
		let awards1 = awardsOfB.mul(bet1).dividedToIntegerBy(bet1.add(bet2));
		let awards2 = awardsOfB.mul(bet2).dividedToIntegerBy(bet1.add(bet2));
		
		let highestAwards = totalAwards.sub(awards0).sub(awardsOfB);
		awards0 = awards0.add(highestAwards);
		
		// Get calculated awards.
		let awardsFromContract0 = await game.calculateAwardAmount(gameId, {from: accounts[7]});
		let awardsFromContract1 = await game.calculateAwardAmount(gameId, {from: accounts[8]});
		let awardsFromContract2 = await game.calculateAwardAmount(gameId, {from: accounts[9]});
		
		assert.ok(awardsFromContract0.eq(awards0));
		assert.ok(awardsFromContract1.eq(awards1));
		assert.ok(awardsFromContract2.eq(awards2));
		
		// Get balance at beginning.
		let balanceBegin0 = await getBalance(accounts[7]);
		let balanceBegin1 = await getBalance(accounts[8]);
		let balanceBegin2 = await getBalance(accounts[9]);
		
		// Withdraw.
		await game.getAwards(gameId, {from: accounts[7]});
		await game.getAwards(gameId, {from: accounts[8]});
		await game.getAwards(gameId, {from: accounts[9]});
		
		// Get balance at ending. 
		let balanceFinal0 = await getBalance(accounts[7]);
		let balanceFinal1 = await getBalance(accounts[8]);
		let balanceFinal2 = await getBalance(accounts[9]);
		
		assert.ok(balanceBegin0.add(awards0).sub(balanceFinal0).lte(threshold));
		assert.ok(balanceBegin1.add(awards1).sub(balanceFinal1).lte(threshold));
		assert.ok(balanceBegin2.add(awards2).sub(balanceFinal2).lte(threshold));
	});
	
	it("Game - Two highest change rate winner, one highest bets", async function () {
		let game = await GamePoolTestProxy.deployed();
		
		// Test is closed.
		let numberOfGames = await game.numberOfGames.call();
		assert.ok(numberOfGames > 0);
		
		let gameId = numberOfGames - 1;
		
		// Bets.
		await game.bet(gameId, 0, {value: web3.toWei(30, "finney"), from: accounts[7]});
		await game.bet(gameId, 0, {value: web3.toWei(20, "finney"), from: accounts[8]});
		await game.bet(gameId, 0, {value: web3.toWei(10, "finney"), from: accounts[9]});
		await game.bet(gameId, 1, {value: web3.toWei(10, "finney"), from: accounts[1]});
		await game.bet(gameId, 2, {value: web3.toWei(10, "finney"), from: accounts[2]});
		await game.bet(gameId, 3, {value: web3.toWei(10, "finney"), from: accounts[3]});
		await game.bet(gameId, 4, {value: web3.toWei(10, "finney"), from: accounts[4]});
		
		// Close the game.
		let endExRate = [120 // 20%
			, 220 // 10%
			, 300 // 0%
			, 360 // -10%
			, 600]; // 20%
		await game.setEndExRate(gameId, endExRate);
		await game.setY(gameId, 10);
		await game.close(gameId, {from: accounts[0], gasLimit: 371211});
		
		// Test the coin result.
		for (let i = 0; i < 5; ++i) {
			let coin = await game.gameCoinData.call(gameId, i);
			assert.equal(coin[1], startExRate[i]); // startExRate
			assert.ok(coin[2] != 0);               // timeStampOfStartExRate
			assert.equal(coin[3], endExRate[i]);   // endExRate
			assert.ok(coin[4] != 0);               // timeStampOfEndExRate
		}
		
		// Test the game state.
		let gameState = await game.gameState.call(gameId);
		assert.equal(gameState, 6); // Close state.
		
		// Test the winners.
		let numberOfWinnerCoinIds = await game.gameNumberOfWinnerCoinIds.call(gameId);
		assert.ok(numberOfWinnerCoinIds.eq(2));
		
		let winnerId = await game.gameWinnerCoinIds.call(gameId, 0);
		assert.ok(winnerId.eq(0));
		
		winnerId = await game.gameWinnerCoinIds.call(gameId, 1);
		assert.ok(winnerId.eq(4));
		
		// Calculate awards.
		let gameData = await game.games.call(gameId);
		
		let A = gameData[7];
		let B = gameData[8];
		
		let oneHundred = web3.toBigNumber("100");
		
		let totalAwards = web3.toBigNumber(web3.toWei(99500, "microether"));
		totalAwards = totalAwards.dividedToIntegerBy(web3.toBigNumber("2"));
		
		let bet0 = web3.toBigNumber(web3.toWei(29850, "microether")); 
		let bet1 = web3.toBigNumber(web3.toWei(19900, "microether"));
		let bet2 = web3.toBigNumber(web3.toWei(9950, "microether")); 
		let bet4 = web3.toBigNumber(web3.toWei(9950, "microether")); 
		
		let awardsOfB = totalAwards.mul(B).dividedToIntegerBy(oneHundred); 
		
		let awards0 = totalAwards.mul(A).dividedToIntegerBy(oneHundred);
		let awards1 = awardsOfB.mul(bet1).dividedToIntegerBy(bet1.add(bet2));
		let awards2 = awardsOfB.mul(bet2).dividedToIntegerBy(bet1.add(bet2));
		let awards3 = totalAwards;
		
		let highestAwards = totalAwards.sub(awards0).sub(awardsOfB);
		awards0 = awards0.add(highestAwards);
		
		// Get calculated awards.
		let awardsFromContract0 = await game.calculateAwardAmount(gameId, {from: accounts[7]});
		let awardsFromContract1 = await game.calculateAwardAmount(gameId, {from: accounts[8]});
		let awardsFromContract2 = await game.calculateAwardAmount(gameId, {from: accounts[9]});
		let awardsFromContract3 = await game.calculateAwardAmount(gameId, {from: accounts[4]});
		
		assert.ok(awardsFromContract0.eq(awards0));
		assert.ok(awardsFromContract1.eq(awards1));
		assert.ok(awardsFromContract2.eq(awards2));
		assert.ok(awardsFromContract3.eq(awards3));
		
		// Get balance at beginning.
		let balanceBegin0 = await getBalance(accounts[7]);
		let balanceBegin1 = await getBalance(accounts[8]);
		let balanceBegin2 = await getBalance(accounts[9]);
		let balanceBegin3 = await getBalance(accounts[4]);
		
		// Withdraw.
		await game.getAwards(gameId, {from: accounts[7]});
		await game.getAwards(gameId, {from: accounts[8]});
		await game.getAwards(gameId, {from: accounts[9]});
		await game.getAwards(gameId, {from: accounts[4]});
		
		// Get balance at ending. 
		let balanceFinal0 = await getBalance(accounts[7]);
		let balanceFinal1 = await getBalance(accounts[8]);
		let balanceFinal2 = await getBalance(accounts[9]);
		let balanceFinal3 = await getBalance(accounts[4]);
		
		assert.ok(balanceBegin0.add(awards0).sub(balanceFinal0).lte(threshold));
		assert.ok(balanceBegin1.add(awards1).sub(balanceFinal1).lte(threshold));
		assert.ok(balanceBegin2.add(awards2).sub(balanceFinal2).lte(threshold));
		assert.ok(balanceBegin3.add(awards3).sub(balanceFinal3).lte(threshold));
	});
	
	it("Game - No winners. Total bets are equal.", async function () {
		let game = await GamePoolTestProxy.deployed();
		
		// Get game id.
		let numberOfGames = await game.numberOfGames.call();
		assert.ok(numberOfGames > 0);
		
		let gameId = numberOfGames - 1;
		
		// Bets.
		await game.bet(gameId, 0, {value: web3.toWei(10, "finney"), from: accounts[7]});
		await game.bet(gameId, 1, {value: web3.toWei(10, "finney"), from: accounts[1]});
		await game.bet(gameId, 2, {value: web3.toWei(10, "finney"), from: accounts[2]});
		await game.bet(gameId, 3, {value: web3.toWei(10, "finney"), from: accounts[3]});
		await game.bet(gameId, 4, {value: web3.toWei(10, "finney"), from: accounts[4]});
	
		// Close the game.
		let endExRate = [100 // 0%
			, 220 // 10%
			, 300 // 0%
			, 360 // -10%
			, 600]; // 20%
		await game.setEndExRate(gameId, endExRate);
		await game.setY(gameId, 10);
		await game.close(gameId, {from: accounts[0], gasLimit: 371211});
		
		// Test the game state.
		let gameState = await game.gameState.call(gameId);
		assert.equal(gameState, 3); // Open state.
		
		// Test the winners.
		let numberOfWinnerCoinIds = await game.gameNumberOfWinnerCoinIds.call(gameId);
		assert.ok(numberOfWinnerCoinIds.eq(0));
	});
	
	it("Game - No winners. Every coins are highest or smallest change rate.", async function () {
		let game = await GamePoolTestProxy.deployed();
		
		// Test is closed.
		let numberOfGames = await game.numberOfGames.call();
		assert.ok(numberOfGames > 0);
		
		let gameId = numberOfGames - 1;
		
		// Bets.
		await game.bet(gameId, 0, {value: web3.toWei(10, "finney"), from: accounts[7]});
		await game.bet(gameId, 1, {value: web3.toWei(10, "finney"), from: accounts[1]});
		await game.bet(gameId, 2, {value: web3.toWei(10, "finney"), from: accounts[2]});
		await game.bet(gameId, 3, {value: web3.toWei(10, "finney"), from: accounts[3]});
		await game.bet(gameId, 4, {value: web3.toWei(10, "finney"), from: accounts[4]});
	
		// Close the game.
		let endExRate = [120 // 20%
			, 240 // 20%
			, 270 // -10%
			, 360 // -10%
			, 600]; // 20%
		await game.setEndExRate(gameId, endExRate);
		await game.setY(gameId, 10);
		await game.close(gameId, {from: accounts[0], gasLimit: 371211});
		
		// Test the game state.
		let gameState = await game.gameState.call(gameId);
		assert.equal(gameState, 3); // Open state.
		
		// Test the winners.
		let numberOfWinnerCoinIds = await game.gameNumberOfWinnerCoinIds.call(gameId);
		assert.ok(numberOfWinnerCoinIds.eq(0));
	});
	
	it("Game - Tied on highest and samllest change rate. Only one in the rest group, sole winner, one highest bets.", async function () {
		let game = await GamePoolTestProxy.deployed();
		
		// Test is closed.
		let numberOfGames = await game.numberOfGames.call();
		assert.ok(numberOfGames > 0);
		
		let gameId = numberOfGames - 1;
		
		// Bets.
		await game.bet(gameId, 0, {value: web3.toWei(10, "finney"), from: accounts[7]});
		await game.bet(gameId, 1, {value: web3.toWei(10, "finney"), from: accounts[1]});
		await game.bet(gameId, 2, {value: web3.toWei(10, "finney"), from: accounts[2]});
		await game.bet(gameId, 3, {value: web3.toWei(10, "finney"), from: accounts[3]});
		await game.bet(gameId, 4, {value: web3.toWei(10, "finney"), from: accounts[4]});
		
		// Close the game.
		let endExRate = [100 // 0%
			, 240 // 20%
			, 270 // -10%
			, 360 // -10%
			, 600]; // 20%
		await game.setEndExRate(gameId, endExRate);
		await game.setY(gameId, 10);
		await game.close(gameId, {from: accounts[0], gasLimit: 371211});
		
		// Test the coin result.
		for (let i = 0; i < 5; ++i) {
			let coin = await game.gameCoinData.call(gameId, i);
			assert.equal(coin[1], startExRate[i]); // startExRate
			assert.ok(coin[2] != 0);               // timeStampOfStartExRate
			assert.equal(coin[3], endExRate[i]);   // endExRate
			assert.ok(coin[4] != 0);               // timeStampOfEndExRate
		}
		
		// Test the game state.
		let gameState = await game.gameState.call(gameId);
		assert.equal(gameState, 6); // Close state.
		
		// Test the winners.
		let numberOfWinnerCoinIds = await game.gameNumberOfWinnerCoinIds.call(gameId);
		assert.ok(numberOfWinnerCoinIds.eq(1));
		
		let winnerId = await game.gameWinnerCoinIds.call(gameId, 0);
		assert.ok(winnerId.eq(0));
	
		// Calculate awards
		let totalAwards = web3.toBigNumber(web3.toWei(49750, "microether"));
		
		let awardsFromContract = await game.calculateAwardAmount(gameId, {from: accounts[7]});
		assert.ok(awardsFromContract.eq(totalAwards));
		
		// Get balance at beginning.
		let balanceBegin0 = await getBalance(accounts[7]);
		
		// Withdraw.
		await game.getAwards(gameId, {from: accounts[7]});
		
		// Get balance at ending. 
		let balanceFinal0 = await getBalance(accounts[7]);
		
		assert.ok(balanceBegin0.add(totalAwards).sub(balanceFinal0).lte(threshold));
	});
});