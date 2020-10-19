import { Component, OnInit } from '@angular/core';
import {WalletService} from '../services/wallet.service';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit {

  donationAccount = `flr_3374j6q4uqhpfkph8wpwa9zfqsnjjygw4t9kzzdeu5rptoues131azngr8wo`;

  wallet = this.walletService.wallet;
  isConfigured = this.walletService.isConfigured;

  constructor(private walletService: WalletService) { }

  ngOnInit() {

  }

}
