import { apiBaseUrl } from "./apiConfig";

export interface User {
  id: string;
  name: string;
  email: string;
}

export class AuthService {
  private static instance: AuthService;
  private _currentUser: User | null = null;
  private _isAuthenticated: boolean = false;
  private _isInitialized: boolean = false;
  private _authInitPromise: Promise<boolean> | null = null;

  private constructor() {
    this._authInitPromise = this.checkAuthStatus();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  get isAuthenticated(): boolean {
    return this._isAuthenticated;
  }

  get currentUser(): User | null {
    return this._currentUser;
  }

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  public async waitForInitialization(): Promise<boolean> {
    if (this._isInitialized) {
      return this._isAuthenticated;
    }

    if (this._authInitPromise) {
      return await this._authInitPromise;
    }

    return await this.checkAuthStatus();
  }

  public async checkAuthStatus(): Promise<boolean> {
    try {
      console.log("AuthService: Checking authentication status...");
      const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          this._currentUser = {
            id: data.user._id || data.user.id,
            name: data.user.name,
            email: data.user.email,
          };
          this._isAuthenticated = true;
          console.log("AuthService: User authenticated:", this._currentUser);
        } else {
          this._currentUser = null;
          this._isAuthenticated = false;
          console.log("AuthService: User data missing in response");
        }
      } else {
        this._currentUser = null;
        this._isAuthenticated = false;
        console.log("AuthService: Authentication check failed with status", response.status);
      }
    } catch (error) {
      console.error("AuthService Error:", error);
      this._currentUser = null;
      this._isAuthenticated = false;
    } finally {
      this._isInitialized = true;
      return this._isAuthenticated;
    }
  }

  public async login(email: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        this._currentUser = {
          id: data.user._id || data.user.id,
          name: data.user.name,
          email: data.user.email,
        };
        this._isAuthenticated = true;
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  }

  public async logout(): Promise<boolean> {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      this._currentUser = null;
      this._isAuthenticated = false;

      return response.ok;
    } catch (error) {
      console.error("Logout error:", error);
      return false;
    }
  }
}
