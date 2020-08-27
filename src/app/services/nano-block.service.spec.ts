import { TestBed, inject } from '@angular/core/testing';

import { FlairrBlockService } from './nano-block.service';

describe('FlairrBlockService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FlairrBlockService]
    });
  });

  it('should be created', inject([FlairrBlockService], (service: FlairrBlockService) => {
    expect(service).toBeTruthy();
  }));
});
