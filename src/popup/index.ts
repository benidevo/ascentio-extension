import '@/styles/main.css';
import { config } from '@/config';
import { SettingsService } from '@/background/services/settings/SettingsService';
import { UserSettings } from '@/types/settings';
import { errorService } from '@/background/services/error';
import { Logger } from '@/utils/logger';
import {
  validatePassword,
  validateUsername,
  ValidationResult,
} from '@/utils/validation';

/**
 * Represents the popup UI logic.
 *
 * It handles initialization, job page detection, authentication status, and rendering of UI elements.
 */
class Popup {
  private statusElement: HTMLElement;
  private ctaElement: HTMLElement;
  private settingsView: HTMLElement;
  private isSigningIn = false;
  private currentView: 'main' | 'settings' = 'main';
  private statusTimeout: number | null = null;
  private logger = new Logger('Popup');

  constructor() {
    this.statusElement = document.getElementById('status')!;
    this.ctaElement = document.getElementById('cta')!;
    this.settingsView = document.getElementById('settings-view')!;
  }

  async initialize(): Promise<void> {
    try {
      const isJobPage = await this.checkIfJobPage();
      const isAuthenticated = await this.checkAuthStatus();

      this.render(isAuthenticated, isJobPage);
      this.attachEventListeners(isAuthenticated);
      this.attachSettingsEventListeners();
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'popup_initialize',
      });
      this.renderError(errorDetails.userMessage);
    }
  }

  private async checkAuthStatus(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(['authToken']);
      return !!result.authToken;
    } catch (error) {
      errorService.handleError(error, { action: 'check_auth_status' });
      return false;
    }
  }

  private async checkIfJobPage(): Promise<boolean> {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = tab.url || '';

    return url.includes('linkedin.com/jobs/view/');
  }

  private render(isAuthenticated: boolean, isJobPage: boolean): void {
    if (isJobPage) {
      this.statusElement.innerHTML = `
        <div class="flex items-center justify-center p-3 bg-primary bg-opacity-10 rounded-lg border border-primary border-opacity-30">
          <svg class="w-5 h-5 text-primary mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm font-medium text-primary">Ready to capture job</span>
        </div>
      `;
    } else {
      this.statusElement.innerHTML = `
        <div class="flex items-center justify-center p-3 bg-slate-800 bg-opacity-50 rounded-lg">
          <svg class="w-5 h-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm text-gray-400">Navigate to a job listing</span>
        </div>
      `;
    }

    if (isAuthenticated) {
      this.ctaElement.innerHTML = `
        <a
          href="#"
          id="dashboard-link"
          target="_blank"
          class="vega-btn vega-btn-primary w-full block text-center"
        >
          Open Dashboard
          <svg class="inline-block w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>

        <div class="mt-3 text-center">
          <a href="#" id="signout-btn" class="text-xs text-gray-500 hover:text-gray-400 transition-colors">
            Sign out
          </a>
        </div>
      `;
    } else {
      this.renderAuthOptions();
    }
  }

  private renderError(message: string): void {
    this.statusElement.innerHTML = `
      <div class="vega-alert vega-alert-error">
        <div class="flex items-center justify-center">
          <svg class="w-5 h-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm text-red-400">${message}</span>
        </div>
      </div>
    `;
  }

  private attachEventListeners(isAuthenticated: boolean): void {
    if (isAuthenticated) {
      const signoutBtn = document.getElementById('signout-btn');
      if (signoutBtn) {
        signoutBtn.addEventListener('click', async e => {
          e.preventDefault();
          await this.handleSignOut();
        });
      }
    } else {
      this.attachAuthEventListeners();
    }
  }

  private renderAuthOptions(): void {
    const googleAuthSection = config.features.enableGoogleAuth
      ? `
        <!-- Google OAuth Button -->
        <button
          id="google-signin-btn"
          class="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors flex items-center justify-center"
        >
          <svg class="w-4 h-4 mr-3" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <!-- Divider -->
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-600"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-slate-900 text-gray-400">or</span>
          </div>
        </div>`
      : '';

    this.ctaElement.innerHTML = `
      <div class="space-y-4">
        ${googleAuthSection}

        <!-- Username/Password Form -->
        <div class="space-y-3">
          <div>
            <input
              type="text"
              id="username-input"
              placeholder="Username (3-50 characters)"
              class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            >
            <div id="username-error" class="hidden mt-1 text-xs text-red-400"></div>
            <div id="username-help" class="mt-1 text-xs text-gray-500">Letters, numbers, periods, underscores, and hyphens allowed</div>
          </div>
          <div>
            <input
              type="password"
              id="password-input"
              placeholder="Password (8-64 characters)"
              class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            >
            <div id="password-error" class="hidden mt-1 text-xs text-red-400"></div>
            <div id="password-help" class="mt-1 text-xs text-gray-500">Use a strong, unique password for security</div>
          </div>
          <button
            id="password-signin-btn"
            class="vega-btn vega-btn-primary w-full text-sm"
            disabled
          >
            Sign In
          </button>
        </div>

        <!-- Registration Link -->
        <div class="text-center">
          <a
            href="https://vega.benidevo.com"
            target="_blank"
            class="text-xs text-gray-400 hover:text-gray-300 transition-colors"
          >
            Don't have an account, get started
          </a>
        </div>

        <!-- Error Display -->
        <div id="auth-error" class="hidden p-2 bg-red-900/50 border border-red-500/50 rounded-md">
          <div class="flex items-center">
            <svg class="w-4 h-4 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span id="auth-error-text" class="text-xs text-red-400"></span>
          </div>
        </div>
      </div>
    `;
  }

  private attachAuthEventListeners(): void {
    // Google OAuth button (only if enabled)
    if (config.features.enableGoogleAuth) {
      const googleBtn = document.getElementById('google-signin-btn');
      if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
          await this.handleGoogleSignIn();
        });
      }
    }

    const usernameInput = document.getElementById(
      'username-input'
    ) as HTMLInputElement;
    if (usernameInput) {
      usernameInput.addEventListener('input', () => {
        this.validateUsernameInput();
        this.updateSignInButtonState();
      });
      usernameInput.addEventListener('blur', () => {
        this.validateUsernameInput();
      });
    }

    const passwordInput = document.getElementById(
      'password-input'
    ) as HTMLInputElement;
    if (passwordInput) {
      passwordInput.addEventListener('input', () => {
        this.validatePasswordInput();
        this.updateSignInButtonState();
      });
      passwordInput.addEventListener('blur', () => {
        this.validatePasswordInput();
      });
      passwordInput.addEventListener('keypress', async e => {
        if (e.key === 'Enter' && this.isFormValid()) {
          await this.handlePasswordSignIn();
        }
      });
    }

    // Password sign in button
    const passwordBtn = document.getElementById('password-signin-btn');
    if (passwordBtn) {
      passwordBtn.addEventListener('click', async () => {
        await this.handlePasswordSignIn();
      });
    }
  }

  private async handleGoogleSignIn(): Promise<void> {
    if (this.isSigningIn) return;

    const googleBtn = document.getElementById(
      'google-signin-btn'
    ) as HTMLButtonElement;
    if (!googleBtn) return;

    this.isSigningIn = true;
    const originalText = googleBtn.textContent;
    googleBtn.disabled = true;
    googleBtn.textContent = 'Signing in...';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'LOGIN' });

      if (response && response.success) {
        await this.initialize();
      } else {
        this.showAuthError(response?.error || 'Google sign-in failed');
      }
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'google_auth',
      });
      this.showAuthError(errorDetails.userMessage);
    } finally {
      this.isSigningIn = false;
      googleBtn.disabled = false;
      googleBtn.textContent = originalText;
    }
  }

  private updateValidationUI(
    input: HTMLInputElement,
    errorElement: HTMLElement,
    helpElement: HTMLElement,
    validation: ValidationResult
  ): void {
    if (validation.isValid) {
      input.classList.remove('border-red-500');
      input.classList.add('border-green-500');
      errorElement.classList.add('hidden');
      helpElement.classList.remove('hidden');
    } else {
      input.classList.remove('border-green-500');
      input.classList.add('border-red-500');
      errorElement.textContent = validation.error || '';
      errorElement.classList.remove('hidden');
      helpElement.classList.add('hidden');
    }
  }

  private validateUsernameInput(): ValidationResult {
    const usernameInput = document.getElementById(
      'username-input'
    ) as HTMLInputElement;
    const usernameError = document.getElementById('username-error');
    const usernameHelp = document.getElementById('username-help');

    if (!usernameInput || !usernameError || !usernameHelp) {
      return { isValid: false };
    }

    const validation = validateUsername(usernameInput.value);
    this.updateValidationUI(
      usernameInput,
      usernameError,
      usernameHelp,
      validation
    );
    return validation;
  }

  private validatePasswordInput(): ValidationResult {
    const passwordInput = document.getElementById(
      'password-input'
    ) as HTMLInputElement;
    const passwordError = document.getElementById('password-error');
    const passwordHelp = document.getElementById('password-help');

    if (!passwordInput || !passwordError || !passwordHelp) {
      return { isValid: false };
    }

    const validation = validatePassword(passwordInput.value);
    this.updateValidationUI(
      passwordInput,
      passwordError,
      passwordHelp,
      validation
    );
    return validation;
  }

  private isFormValid(): boolean {
    const usernameInput = document.getElementById(
      'username-input'
    ) as HTMLInputElement;
    const passwordInput = document.getElementById(
      'password-input'
    ) as HTMLInputElement;

    if (!usernameInput || !passwordInput) return false;

    const usernameValid = validateUsername(usernameInput.value).isValid;
    const passwordValid = validatePassword(passwordInput.value).isValid;

    return usernameValid && passwordValid;
  }

  private updateSignInButtonState(): void {
    const passwordBtn = document.getElementById(
      'password-signin-btn'
    ) as HTMLButtonElement;
    if (!passwordBtn) return;

    const isValid = this.isFormValid();
    passwordBtn.disabled = !isValid || this.isSigningIn;

    if (isValid) {
      passwordBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      passwordBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }

  private async handlePasswordSignIn(): Promise<void> {
    if (this.isSigningIn || !this.isFormValid()) return;

    const usernameInput = document.getElementById(
      'username-input'
    ) as HTMLInputElement;
    const passwordInput = document.getElementById(
      'password-input'
    ) as HTMLInputElement;
    const passwordBtn = document.getElementById(
      'password-signin-btn'
    ) as HTMLButtonElement;

    if (!usernameInput || !passwordInput || !passwordBtn) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Final validation before submission
    const usernameValidation = validateUsername(username);
    const passwordValidation = validatePassword(password);

    if (!usernameValidation.isValid) {
      this.showAuthError(usernameValidation.error || 'Invalid username');
      return;
    }

    if (!passwordValidation.isValid) {
      this.showAuthError(passwordValidation.error || 'Invalid password');
      return;
    }

    this.isSigningIn = true;
    const originalText = passwordBtn.textContent;
    passwordBtn.disabled = true;
    passwordBtn.textContent = 'Signing in...';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'LOGIN_WITH_PASSWORD',
        payload: { username, password },
      });

      if (response && response.success) {
        // Small delay to ensure storage is synced
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.initialize();
      } else {
        this.showAuthError(response?.error || 'Sign in failed');
      }
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'password_auth',
      });
      this.showAuthError(errorDetails.userMessage);
    } finally {
      this.isSigningIn = false;
      this.updateSignInButtonState();
      passwordBtn.textContent = originalText;
    }
  }

  private showAuthError(message: string): void {
    const errorDiv = document.getElementById('auth-error');
    const errorText = document.getElementById('auth-error-text');

    if (errorDiv && errorText) {
      errorText.textContent = message;
      errorDiv.classList.remove('hidden');

      // Auto-hide after 5 seconds
      setTimeout(() => {
        errorDiv.classList.add('hidden');
      }, 5000);
    }
  }

  private async handleSignOut(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'LOGOUT' });

      if (response && response.success) {
        await this.initialize();
      } else {
        this.renderError(response?.error || 'Failed to sign out');
      }
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'sign_out',
      });
      this.renderError(errorDetails.userMessage);
    }
  }

  private attachSettingsEventListeners(): void {
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.showSettings());
    }

    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.showMainView());
    }

    const testBtn = document.getElementById('test-connection-btn');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.testConnection());
    }

    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveSettings());
    }

    this.updateDashboardLink();
  }

  private async showSettings(): Promise<void> {
    this.currentView = 'settings';

    this.statusElement.classList.add('hidden');
    this.ctaElement.classList.add('hidden');

    this.settingsView.classList.remove('hidden');

    const settings = await SettingsService.getSettings();
    const protocolSelect = document.getElementById(
      'api-protocol'
    ) as HTMLSelectElement;
    const hostInput = document.getElementById('api-host') as HTMLInputElement;

    if (protocolSelect) protocolSelect.value = settings.apiProtocol;
    if (hostInput) hostInput.value = settings.apiHost;
  }

  private showMainView(): void {
    this.currentView = 'main';

    this.statusElement.classList.remove('hidden');
    this.ctaElement.classList.remove('hidden');

    this.settingsView.classList.add('hidden');

    this.hideSettingsStatus();
  }

  private async testConnection(): Promise<void> {
    const protocolSelect = document.getElementById(
      'api-protocol'
    ) as HTMLSelectElement;
    const hostInput = document.getElementById('api-host') as HTMLInputElement;

    if (!protocolSelect || !hostInput) return;

    const protocol = protocolSelect.value as 'http' | 'https';
    const host = hostInput.value.trim();

    if (!host) {
      this.showSettingsStatus('Please enter a host', 'error');
      return;
    }

    this.showSettingsStatus('Testing connection...', 'info');

    const isConnected = await SettingsService.testConnection(host, protocol);

    if (isConnected) {
      this.showSettingsStatus('Connection successful!', 'success');
    } else {
      this.showSettingsStatus(
        'Connection failed. Please check the host and try again.',
        'error'
      );
    }
  }

  private async saveSettings(): Promise<void> {
    const protocolSelect = document.getElementById(
      'api-protocol'
    ) as HTMLSelectElement;
    const hostInput = document.getElementById('api-host') as HTMLInputElement;

    if (!protocolSelect || !hostInput) return;

    const protocol = protocolSelect.value as 'http' | 'https';
    const host = hostInput.value.trim();

    if (!host) {
      this.showSettingsStatus('Please enter a host', 'error');
      return;
    }

    const settings: UserSettings = {
      apiProtocol: protocol,
      apiHost: host,
    };

    try {
      await SettingsService.saveSettings(settings);
      this.showSettingsStatus('Settings saved successfully!', 'success');

      this.updateDashboardLink();

      // Notify background script to reload services with new settings
      await chrome.runtime.sendMessage({ type: 'RELOAD_SETTINGS' });

      // Go back to main view after a short delay
      setTimeout(() => this.showMainView(), 1500);
    } catch (error) {
      const errorDetails = errorService.handleError(error, {
        action: 'save_settings',
        settings,
      });
      this.showSettingsStatus(errorDetails.userMessage, 'error');
    }
  }

  private showSettingsStatus(
    message: string,
    type: 'info' | 'success' | 'error'
  ): void {
    const statusDiv = document.getElementById('settings-status');
    if (!statusDiv) return;

    // Clear any existing timeout
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }

    const colorClasses = {
      info: 'bg-blue-900/50 border-blue-500/50 text-blue-400',
      success: 'bg-green-900/50 border-green-500/50 text-green-400',
      error: 'bg-red-900/50 border-red-500/50 text-red-400',
    };

    statusDiv.className = `p-2 border rounded-md ${colorClasses[type]}`;
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden');

    // Auto-hide success and info messages after 3 seconds
    if (type === 'success' || type === 'info') {
      this.statusTimeout = window.setTimeout(() => {
        this.hideSettingsStatus();
      }, 3000);
    }
    // Auto-hide error messages after 5 seconds
    else if (type === 'error') {
      this.statusTimeout = window.setTimeout(() => {
        this.hideSettingsStatus();
      }, 5000);
    }
  }

  private hideSettingsStatus(): void {
    const statusDiv = document.getElementById('settings-status');
    if (statusDiv) {
      statusDiv.classList.add('hidden');
    }
  }

  private async updateDashboardLink(): Promise<void> {
    const dashboardLink = document.getElementById(
      'dashboard-link'
    ) as HTMLAnchorElement;
    if (dashboardLink) {
      const baseUrl = await SettingsService.getApiBaseUrl();
      dashboardLink.href = `${baseUrl}/jobs`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const popup = new Popup();
  popup.initialize();
});
