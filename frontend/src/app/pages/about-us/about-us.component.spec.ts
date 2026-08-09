import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AboutUsComponent } from './about-us.component';

describe('AboutUsComponent', () => {
  let component: AboutUsComponent;
  let fixture: ComponentFixture<AboutUsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutUsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AboutUsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens and closes the application technology stack', () => {
    expect(component.showTechnologyStack).toBe(false);
    component.openTechnologyStack();
    expect(component.showTechnologyStack).toBe(true);
    expect(component.technologyStack.some((item) => item.name === 'Frontend')).toBe(true);
    expect(component.technologyStack.some((item) => item.name === 'AI assistant')).toBe(true);
    component.closeTechnologyStack();
    expect(component.showTechnologyStack).toBe(false);
  });

  it('lets the user explore the AI control layers', () => {
    expect(component.activeTrustLayer.key).toBe('you');
    component.activeTrustKey = 'safety';
    expect(component.activeTrustLayer.title).toContain('Sensitive decisions');
  });
});
