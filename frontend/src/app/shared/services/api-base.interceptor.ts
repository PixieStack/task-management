import { HttpInterceptorFn } from '@angular/common/http';

function getBuildApiBaseUrl(): string {
  const configured = typeof APP_API_BASE_URL !== 'undefined' ? APP_API_BASE_URL : '';
  return configured.trim().replace(/\/+$/, '');
}

export const apiBaseInterceptor: HttpInterceptorFn = (request, next) => {
  const apiBaseUrl = getBuildApiBaseUrl();
  const isBackendRequest = request.url.startsWith('/api') || request.url.startsWith('/auth');

  if (!apiBaseUrl || !isBackendRequest) {
    return next(request);
  }

  return next(
    request.clone({
      url: `${apiBaseUrl}${request.url}`,
    }),
  );
};
