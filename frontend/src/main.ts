// main.ts

import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes'; 
import { importProvidersFrom } from '@angular/core';
import { CommonModule } from '@angular/common';
import { appConfig } from './app/app.config';

// Router and HttpClientModule to provide required modules
bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    importProvidersFrom(CommonModule, HttpClientModule), 
    provideRouter(routes)
  ]
})
.catch(err => console.error(err));