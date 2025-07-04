import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountSecurityComponent } from './account-security.component';

describe('AccountSecurityComponent', () => {
  let component: AccountSecurityComponent;
  let fixture: ComponentFixture<AccountSecurityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountSecurityComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountSecurityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
