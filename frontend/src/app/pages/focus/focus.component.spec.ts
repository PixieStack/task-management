import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { FocusComponent } from './focus.component';

describe('FocusComponent', () => {
  let fixture: ComponentFixture<FocusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FocusComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(FocusComponent);
  });

  afterEach(() => fixture.destroy());

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
