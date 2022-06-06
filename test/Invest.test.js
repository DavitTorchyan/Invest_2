const { messagePrefix } = require("@ethersproject/hash");
const { expect } = require("chai");
const {
	deployments
} = require("hardhat");
const {
  ethers: {
    getContractFactory,
    BigNumber,
    getNamedSigners
  }, ethers, timeAndMine
} = require("hardhat");
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace");


describe("Invest", function () {
  let invest, stakeToken, accounts, Invest;
  let deployer, caller, holder;
  beforeEach("idk", async function () {
    accounts = await ethers.getSigners();
    ([deployer, caller, holder] = accounts);    
    const StakeToken = await hre.ethers.getContractFactory("StakeToken");
    stakeToken = await StakeToken.deploy();
    await stakeToken.deployed();
    Invest = await hre.ethers.getContractFactory("Invest");
    invest = await Invest.deploy(stakeToken.address, { value: ethers.utils.parseEther("100") });
    await stakeToken.mint(caller.address, ethers.utils.parseUnits("100"));
    await stakeToken.mint(invest.address, ethers.utils.parseUnits("100"));
    await invest.deployed();
  })

  it("Should deploy correctly.", async function() {
    expect(stakeToken.address != ethers.constants.AddressZero, "Token address should not be address zero.");
  })

  it("Should revert with message `Token address can not be zero.`", async function() {
    await expect(Invest.deploy(ethers.constants.AddressZero)).to.be.revertedWith("Token address can not be zero.");
  })

  it("Should invest tokens correctly.", async function() {
    await stakeToken.connect(caller).approve(invest.address, ethers.utils.parseUnits("10"));
    await invest.connect(caller).invest(ethers.utils.parseUnits("10"));
    // console.log((await invest.investInfo(caller.address, 0)).investAmount);
    expect((await invest.investInfo(caller.address, 0)).asset).to.equal(1);
    expect((await invest.investInfo(caller.address, 0)).investAmount).to.equal(ethers.utils.parseUnits("10"));
    expect((await invest.totalTokensInvested(caller.address))).to.equal(ethers.utils.parseUnits("10"));
  })

  it("Should invest ether correctly.", async function() {
    await invest.connect(caller).invest(0, {value: ethers.utils.parseEther("5")});
    // console.log((await invest.investInfo(caller.address, 0)).investAmount);
    expect((await invest.investInfo(caller.address, 0)).asset).to.equal(0);
    expect((await invest.investInfo(caller.address, 0)).investAmount).to.equal(ethers.utils.parseEther("5"));
    expect((await invest.totalEtherInvested(caller.address))).to.equal(ethers.utils.parseEther("5"));
  })

  it("Should revert with message `Can not invest both tokens and ether.`", async function() {
    await expect((invest.connect(caller).invest(ethers.utils.parseUnits("10"), {value: ethers.utils.parseEther("5")}))).to.be.revertedWith("Can not invest both tokens and ether.");
  })

  it("Should revert with message `Have to invest some amount.`", async function() {
    await expect((invest.connect(caller).invest(0))).to.be.revertedWith("Have to invest some amount.");
  })

  it("Should claim the reward correctly.", async function() {
    await stakeToken.connect(caller).approve(invest.address, ethers.utils.parseUnits("100"));
    await invest.connect(caller).invest(ethers.utils.parseUnits("100"));
    const balance = await stakeToken.balanceOf(caller.address); 
    // console.log(await ethers.provider.getBlockNumber());
    await timeAndMine.mine(10);
    // console.log(await ethers.provider.getBlockNumber());
    await invest.connect(caller).claim(0);
    expect(await stakeToken.balanceOf(caller.address)).to.equal(BigNumber.from(balance).add(ethers.utils.parseUnits("10")));
  })

  it("Should withdraw tokens correctly.", async function() {
    await stakeToken.connect(caller).approve(invest.address, ethers.utils.parseUnits("100"));
    await invest.connect(caller).invest(ethers.utils.parseUnits("100"));
    // console.log((await invest.investInfo(caller.address, 0)).investAmount)
    const tokensInvested = await invest.totalTokensInvested(caller.address);
    const balance = await stakeToken.balanceOf(caller.address);
    const investAmount = (await invest.investInfo(caller.address, 0)).investAmount;
    await timeAndMine.mine(5);
    await invest.connect(caller).withdrawToken(ethers.utils.parseUnits("50"), 0);
    expect((await invest.totalTokensInvested(caller.address))).to.equal(BigNumber.from(tokensInvested).sub(ethers.utils.parseUnits("50")));
    expect((await invest.investInfo(caller.address, 0)).investAmount).to.equal(BigNumber.from(investAmount).sub(ethers.utils.parseUnits("50")));
    expect((await stakeToken.balanceOf(caller.address))).to.equal(BigNumber.from(balance).add(ethers.utils.parseUnits("55")));
  })

  it.only("Should withdraw ether correctly.", async function() {
    await invest.connect(caller).invest(0, {value: ethers.utils.parseEther("100")});
    const balance = await ethers.provider.getBalance(caller.address);
    const etherInvested = await invest.totalEtherInvested(caller.address);
    await timeAndMine.mine(5);
    const tx = await invest.connect(caller).withdrawEther(ethers.utils.parseEther("50"), 0);
    console.log(tx);
    const gasFee = ((await tx.wait()).gasUsed).mul(1238343378);     
    expect((await invest.totalEtherInvested(caller.address))).to.equal(BigNumber.from(etherInvested).sub(ethers.utils.parseEther("50")));
    expect((await ethers.provider.getBalance(caller.address)).add(gasFee)).to.equal(BigNumber.from(balance).add(ethers.utils.parseEther("55")));
  })

  it("Should revert with message `Can not withdraw anything other than Stake Token.`", async function() {
    await invest.connect(caller).invest(0, {from: caller.address, value: ethers.utils.parseEther("100")});
    await expect((invest.connect(caller).withdrawToken(ethers.utils.parseUnits("10"), 0))).to.be.revertedWith("Can not withdraw anything other than Stake Token.");
  })

  it("Should revert with message `Not enough investments, try lesser amount.`", async function() {
    await stakeToken.connect(caller).approve(invest.address, ethers.utils.parseUnits("100"));
    await invest.connect(caller).invest(ethers.utils.parseUnits("100"));
    await expect((invest.connect(caller).withdrawToken(ethers.utils.parseUnits("200"), 0))).to.be.revertedWith("Not enough investments, try lesser amount.");
  })

  it("Should revert with message `Can not withdraw anything other than Ether.`", async function() {
    await stakeToken.connect(caller).approve(invest.address, ethers.utils.parseUnits("100"));
    await invest.connect(caller).invest(ethers.utils.parseUnits("100"));
    await expect((invest.connect(caller).withdrawEther(ethers.utils.parseUnits("100"), 0))).to.be.revertedWith("Can not withdraw anything other than Ether.");
  })

  it("Should revert with message `Not enough investments, try lesser amount.`", async function() {
    await invest.connect(caller).invest(0, {value: ethers.utils.parseEther("100")});
    await expect((invest.connect(caller).withdrawEther(ethers.utils.parseEther("200"), 0))).to.be.revertedWith("Not enough investments, try lesser amount.");
  })

})
  