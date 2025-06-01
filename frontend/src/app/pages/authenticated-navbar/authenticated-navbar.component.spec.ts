import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthenticatedNavbarComponent } from './authenticated-navbar.component';

describe('AuthenticatedNavbarComponent', () => {
  let component: AuthenticatedNavbarComponent;
  let fixture: ComponentFixture<AuthenticatedNavbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthenticatedNavbarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuthenticatedNavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
