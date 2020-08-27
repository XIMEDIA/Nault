import { Component, OnInit } from '@angular/core';
import BigNumber from 'bignumber.js';
import {AddressBookService} from '../../services/address-book.service';
import {BehaviorSubject} from 'rxjs';
import {WalletService} from '../../services/wallet.service';
import {NotificationService} from '../../services/notification.service';
import {ApiService} from '../../services/api.service';
import {UtilService} from '../../services/util.service';
import {WorkPoolService} from '../../services/work-pool.service';
import {AppSettingsService} from '../../services/app-settings.service';
import {ActivatedRoute} from '@angular/router';
import {PriceService} from '../../services/price.service';
import {FlairrBlockService} from '../../services/nano-block.service';
import { QrModalService } from '../../services/qr-modal.service';

const nacl = window['nacl'];

@Component({
  selector: 'app-send',
  templateUrl: './send.component.html',
  styleUrls: ['./send.component.css']
})
export class SendComponent implements OnInit {
  flr = 1000000000000000000000000;

  activePanel = 'send';

  accounts = this.walletService.wallet.accounts;
  addressBookResults$ = new BehaviorSubject([]);
  showAddressBook = false;
  addressBookMatch = '';

  amounts = [
    { name: 'FLR (1 Mflr)', shortName: 'FLR', value: 'mFlr' },
    { name: 'kFlr (0.001 Mflr)', shortName: 'kFlr', value: 'kFlr' },
    { name: 'flr (0.000001 Mflr)', shortName: 'flr', value: 'flr' },
  ];
  selectedAmount = this.amounts[0];

  amount = null;
  amountRaw = new BigNumber(0);
  amountFiat: number|null = null;
  rawAmount: BigNumber = new BigNumber(0);
  fromAccount: any = {};
  fromAccountID: any = '';
  fromAddressBook = '';
  toAccount: any = false;
  toAccountID = '';
  toAddressBook = '';
  toAccountStatus = null;
  confirmingTransaction = false;
  selAccountInit = false;

  constructor(
    private router: ActivatedRoute,
    private walletService: WalletService,
    private addressBookService: AddressBookService,
    private notificationService: NotificationService,
    private nodeApi: ApiService,
    private flairrBlock: FlairrBlockService,
    public price: PriceService,
    private workPool: WorkPoolService,
    public settings: AppSettingsService,
    private util: UtilService,
    private qrModalService: QrModalService, ) { }

  async ngOnInit() {
    const params = this.router.snapshot.queryParams;

    if (params && params.amount) {
      this.amount = params.amount;
    }
    if (params && params.to) {
      this.toAccountID = params.to;
      this.validateDestination();
    }

    this.addressBookService.loadAddressBook();

    // Set default From account
    this.fromAccountID = this.accounts.length ? this.accounts[0].id : '';

    // Update selected account if changed in the sidebar
    this.walletService.wallet.selectedAccount$.subscribe(async acc => {
      if (this.selAccountInit) {
        if (acc) {
          this.fromAccountID = acc.id;
        } else {
          this.findFirstAccount();
        }
      }
      this.selAccountInit = true;
    });

    // Set the account selected in the sidebar as default
    if (this.walletService.wallet.selectedAccount !== null) {
      this.fromAccountID = this.walletService.wallet.selectedAccount.id;
    } else {
      // If "total balance" is selected in the sidebar, use the first account in the wallet that has a balance
      this.findFirstAccount();
    }
  }

  async findFirstAccount() {
    // Load balances before we try to find the right account
    if (this.walletService.wallet.balance.isZero()) {
      await this.walletService.reloadBalances();
    }

    // Look for the first account that has a balance
    const accountIDWithBalance = this.accounts.reduce((previous, current) => {
      if (previous) return previous;
      if (current.balance.gt(0)) return current.id;
      return null;
    }, null);

    if (accountIDWithBalance) {
      this.fromAccountID = accountIDWithBalance;
    }
  }

  // An update to the Nano amount, sync the fiat value
  syncFiatPrice() {
    const rawAmount = this.getAmountBaseValue(this.amount || 0).plus(this.amountRaw);
    if (rawAmount.lte(0)) {
      this.amountFiat = 0;
      return;
    }

    // This is getting hacky, but if their currency is bitcoin, use 6 decimals, if it is not, use 2
    const precision = this.settings.settings.displayCurrency === 'BTC' ? 1000000 : 100;

    // Determine fiat value of the amount
     const fiatAmount = this.util.flr.rawToMflr(rawAmount).times(this.price.price.lastPrice).times(precision).floor().div(precision).toNumber();

    this.amountFiat = fiatAmount;
  }

  // An update to the fiat amount, sync the nano value based on currently selected denomination
  syncFlairrPrice() {
    const fiatAmount = this.amountFiat || 0;
    const rawAmount = this.util.flr.mFlrToRaw(new BigNumber(fiatAmount).div(this.price.price.lastPrice));
    const flairrVal = this.util.flr.rawToFlr(rawAmount).floor();
    const flairrAmount = this.getAmountValueFromBase(this.util.flr.flrToRaw(flairrVal));
    this.amount = flairrAmount.toNumber();
    }

  searchAddressBook() {
    this.showAddressBook = true;
    const search = this.toAccountID || '';
    const addressBook = this.addressBookService.addressBook;

    const matches = addressBook
      .filter(a => a.name.toLowerCase().indexOf(search.toLowerCase()) !== -1)
      .slice(0, 5);

    this.addressBookResults$.next(matches);
  }

  selectBookEntry(account) {
    this.showAddressBook = false;
    this.toAccountID = account;
    this.searchAddressBook();
    this.validateDestination();
  }

  async validateDestination() {
    // The timeout is used to solve a bug where the results get hidden too fast and the click is never registered
    setTimeout(() => this.showAddressBook = false, 400);

    // Remove spaces from the account id
    this.toAccountID = this.toAccountID.replace(/ /g, '');

    this.addressBookMatch = this.addressBookService.getAccountName(this.toAccountID);

    // const accountInfo = await this.walletService.walletApi.accountInfo(this.toAccountID);
    const accountInfo = await this.nodeApi.accountInfo(this.toAccountID);
    if (accountInfo.error) {
      if (accountInfo.error === 'Account not found') {
        this.toAccountStatus = 1;
      } else {
        this.toAccountStatus = 0;
      }
    }
    if (accountInfo && accountInfo.frontier) {
      this.toAccountStatus = 2;
    }
  }

  async sendTransaction() {
    const isValid = this.util.account.isValidAccount(this.toAccountID);
    if (!isValid) {
      return this.notificationService.sendWarning(`To account address is not valid`);
    }
    if (!this.fromAccountID || !this.toAccountID) {
      return this.notificationService.sendWarning(`From and to account are required`);
    }

    const from = await this.nodeApi.accountInfo(this.fromAccountID);
    const to = await this.nodeApi.accountInfo(this.toAccountID);
    if (!from) {
      return this.notificationService.sendError(`From account not found`);
    }

    from.balanceBN = new BigNumber(from.balance || 0);
    to.balanceBN = new BigNumber(to.balance || 0);

    this.fromAccount = from;
    this.toAccount = to;

    const rawAmount = this.getAmountBaseValue(this.amount || 0);
    this.rawAmount = rawAmount.plus(this.amountRaw);

    const flairrAmount = this.rawAmount.div(this.flr);

    if (this.amount < 0 || rawAmount.lessThan(0)) {
      return this.notificationService.sendWarning(`Amount is invalid`);
    }
if (flairrAmount.lessThan(1)) return this.notificationService.sendWarning(`Transactions for less than 1 flairrcoin will be ignored by the node.  Send raw amounts with at least 1 flairrcoin.`);
    if (from.balanceBN.minus(rawAmount).lessThan(0)) return this.notificationService.sendError(`From account does not have enough FLAIRRCOIN`);    


    // Determine a proper raw amount to show in the UI, if a decimal was entered
    this.amountRaw = this.rawAmount.mod(this.flr);

    // Determine fiat value of the amount
    this.amountFiat = this.util.flr.rawToMflr(rawAmount).times(this.price.price.lastPrice).toNumber();
    // Start precopmuting the work...
    this.fromAddressBook = this.addressBookService.getAccountName(this.fromAccountID);
    this.toAddressBook = this.addressBookService.getAccountName(this.toAccountID);
    this.workPool.addWorkToCache(this.fromAccount.frontier);

    this.activePanel = 'confirm';
  }

  async confirmTransaction() {
    const walletAccount = this.walletService.wallet.accounts.find(a => a.id === this.fromAccountID);
    if (!walletAccount) {
      throw new Error(`Unable to find sending account in wallet`);
    }
    if (this.walletService.walletIsLocked()) {
      return this.notificationService.sendWarning(`Wallet must be unlocked`);
    }

    this.confirmingTransaction = true;

    try {
      const newHash = await this.flairrBlock.generateSend(walletAccount, this.toAccountID, this.rawAmount, this.walletService.isLedgerWallet());
        if (newHash) {
        this.notificationService.sendSuccess(`Successfully sent ${this.amount} ${this.selectedAmount.shortName}!`);
        this.activePanel = 'send';
        this.amount = null;
        this.amountFiat = null;
        this.resetRaw();
        this.toAccountID = '';
        this.toAccountStatus = null;
        this.fromAddressBook = '';
        this.toAddressBook = '';
        this.addressBookMatch = '';
      } else {
        if (!this.walletService.isLedgerWallet()) {
          this.notificationService.sendError(`There was an error sending your transaction, please try again.`);
        }
      }
    } catch (err) {
      this.notificationService.sendError(`There was an error sending your transaction: ${err.message}`);
    }


    this.confirmingTransaction = false;

    await this.walletService.reloadBalances();
  }

  setMaxAmount() {
    const walletAccount = this.walletService.wallet.accounts.find(a => a.id === this.fromAccountID);
    if (!walletAccount) {
      return;
    }

    this.amountRaw = walletAccount.balanceRaw;

    const nanoVal = this.util.flr.rawToFlr(walletAccount.balance).floor();
    const maxAmount = this.getAmountValueFromBase(this.util.flr.flrToRaw(nanoVal));
    this.amount = maxAmount.toNumber();
    this.syncFiatPrice();
  }

  resetRaw() {
    this.amountRaw = new BigNumber(0);
  }

  getAmountBaseValue(value) {

    switch (this.selectedAmount.value) {
      default:
        case 'flr': return this.util.flr.flrToRaw(value);
        case 'kFlr': return this.util.flr.kFlrToRaw(value);
        case 'mFlr': return this.util.flr.mFlrToRaw(value);
    }
  }

  getAmountValueFromBase(value) {
    switch (this.selectedAmount.value) {
      default:
        case 'flr': return this.util.flr.rawToFlr(value);
        case 'kFlr': return this.util.flr.rawToKflr(value);
        case 'mFlr': return this.util.flr.rawToMflr(value);
    }
  }

  // open qr reader modal
  openQR(reference, type) {
    const qrResult = this.qrModalService.openQR(reference, type);
    qrResult.then((data) => {
      switch (data.reference) {
        case 'account1':
          this.toAccountID = data.content;
          this.validateDestination();
          break;
      }
    }, () => {}
    );
  }

}
