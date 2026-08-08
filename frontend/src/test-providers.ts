import { EnvironmentProviders, Provider } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

const testProviders: Array<Provider | EnvironmentProviders> = [
  provideRouter([]),
  provideNoopAnimations(),
];

export default testProviders;
