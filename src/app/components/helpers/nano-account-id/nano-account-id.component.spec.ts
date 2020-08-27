import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FlairrAccountIdComponent } from './nano-account-id.component';

describe('FlairrAccountIdComponent', () => {
  let component: FlairrAccountIdComponent;
  let fixture: ComponentFixture<FlairrAccountIdComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FlairrAccountIdComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FlairrAccountIdComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
