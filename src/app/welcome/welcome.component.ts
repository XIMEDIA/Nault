import { Component, OnInit } from '@angular/core';
import {WalletService} from '../services/wallet.service';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit {

  donationAccount = `flr_3iy3bgq6943o3hdf6ds84i1tijugsmxjgbg4h5kzx7ow3g6hydnxpgxrhci9`;

  wallet = this.walletService.wallet;
  isConfigured = this.walletService.isConfigured;

  constructor(private walletService: WalletService) { }

  ngOnInit() {

  }

}
