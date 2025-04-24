import { Component, Port } from "../models/Component";
import { VerilogCircuitConverter } from "../models/utils/VerilogCircuitConverter";
import { Wire } from "../models/Wire";
import { apiBaseUrl } from "../services/apiConfig";

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  date: Date;
  text: string;
  likes: number;
}

export interface CircuitEntry {
  isPublic: boolean;
  id: string;
  name: string;
  title?: string;
  description: string;
  userId: string | { _id: string };
  authorName: string;
  dateCreated: Date;
  dateModified: Date;
  tags: string[];
  verilogCode: string;
  likes: number;
  downloads: number;
  comments: Comment[];
  thumbnailUrl?: string;
  components: any[];
  wires: any[];
  isShared?: boolean;
  sharedWith: string[];
}

export interface CircuitRepositoryService {
  getCircuits(): Promise<CircuitEntry[]>;
  getCircuitById(id: string): Promise<CircuitEntry>;
  searchCircuits(query: string): Promise<CircuitEntry[]>;
  uploadCircuit(
    circuit: Omit<
      CircuitEntry,
      "id" | "dateCreated" | "dateModified" | "likes" | "downloads" | "comments"
    >
  ): Promise<CircuitEntry>;
  likeCircuit(id: string): Promise<void>;
  downloadCircuit(id: string): Promise<string>;
  addComment(circuitId: string, comment: Omit<Comment, "id" | "date" | "likes">): Promise<Comment>;
  deleteCircuit(id: string): Promise<void>;
  getSharedCircuits(): Promise<CircuitEntry[]>; // Paylaşılan devreleri getir
  updateCircuitVisibility(id: string, isPublic: boolean): Promise<void>; // Görünürlüğü güncelle
  shareCircuitWithUser(id: string, username: string): Promise<void>; 
}
export function createRepositoryUI(): HTMLElement {
  const container = document.createElement("div");
  container.id = "circuit-repository";
  container.className = "repository-modal";
  container.style.display = "none";

  container.innerHTML = `
    <div class="repository-content">
      <div class="repository-header">
        <div class="repository-title">Circuit Repository</div>
        <button class="close-button" id="repo-close-btn">×</button>
      </div>
      
      <div class="repository-tabs">
        <div class="tab active" data-tab="browse">Browse Circuits</div>
        <div class="tab" data-tab="my-circuits">My Circuits</div>
        <div class="tab" data-tab="shared-me">Shared with Me</div>
      </div>
      
      <div class="search-container">
        <input type="text" id="circuit-search" placeholder="Search circuits...">
        <button class="upload-button" id="upload-circuit-btn">Upload Circuit</button>
      </div>
      
      <div class="circuit-grid" id="circuit-grid">
        <div class="loading-indicator">Loading circuits...</div>
      </div>
      
      <div class="circuit-detail" id="circuit-detail" style="display: none;">
        <button class="back-button" id="back-to-grid-btn">← Back to List</button>
        <div class="circuit-detail-container" id="detail-container">
          <!-- Circuit details will be loaded here -->
        </div>
      </div>
    </div>
    
    <div class="upload-form" id="upload-form" style="display: none;">
      <div class="form-header">
        <div class="form-title">Upload New Circuit</div>
        <button class="close-button" id="close-upload-form">×</button>
      </div>
      
      <form id="circuit-upload-form">
        <div class="form-field">
          <label for="circuit-title">Title</label>
          <input type="text" id="circuit-title" required>
        </div>
        
        <div class="form-field">
          <label for="circuit-description">Description</label>
          <textarea id="circuit-description" rows="4" required></textarea>
        </div>
        
        <div class="form-field">
          <label for="circuit-tags">Tags (comma separated)</label>
          <input type="text" id="circuit-tags" placeholder="e.g. adder, 4-bit, alu">
        </div>
        
        <div class="form-field">
          <label for="circuit-code">Verilog Code</label>
          <textarea id="circuit-code" rows="10" required></textarea>
        </div>
        
        <button type="submit">Upload Circuit</button>
      </form>
    </div>
  `;

  return container;
}

export function addRepositoryStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    .repository-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    .repository-content {
      background-color: var(--bg-color);
      border: 3px solid #0b0b0b;
      border-radius: 8px;
      width: 90%;
      height: 90%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 5px 30px rgba(0, 0, 0, 0.5);
      color: var(--text-color);
    }
    
    .repository-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 3px solid #0b0b0b;
      background-color: var(--bg-color);
    }
    
    .repository-title {
      margin: 0;
      color: var(--text-color);
      font-family: "Pixelify Sans", sans-serif;
      font-optical-sizing: auto;
      font-weight: 900;
      font-size: xx-large;
    }
    
    .close-button {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--text-color);
      transition: color 0.2s;
    }
    
    .close-button:hover {
      color: var(--highlight-color);
    }
    
    .repository-tabs {
      display: flex;
      background-color: var(--secondary-bg);
      border-bottom: 1px solid var(--border-color);
    }
    
    .tab {
      padding: 12px 24px;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 500;
      transition: all 0.2s;
      color: var(--text-color);
    }
    
    .tab:hover {
      background-color: var(--component-bg);
    }
    
    .tab.active {
      border-bottom-color: var(--highlight-color);
      color: var(--highlight-color);
      font-weight: 600;
    }
    
    .search-container {
      display: flex;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border-color);
      background-color: var(--secondary-bg);
    }
    
    .search-container input {
      flex: 1;
      padding: 10px 16px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-size: 14px;
      background-color: var(--component-bg);
      color: var(--text-color);
      transition: border-color 0.2s;
    }
    
    .search-container input:focus {
      border-color: var(--highlight-color);
      outline: none;
      box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
    }
    
    .upload-button {
      margin-left: 12px;
      padding: 10px 16px;
      background-color: var(--component-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    
    .upload-button:hover {
      background-color: var(--highlight-color);
      color: #fff;
    }
    
    .circuit-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
      padding: 24px;
      overflow-y: auto;
      flex: 1;
      background-color: var(--bg-color);
    }
    
    .circuit-card {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
      background-color: var(--secondary-bg);
      box-shadow: 2px 2px 4px rgba(0, 0, 0, 1);
    }
    
    .circuit-card:hover {
      transform: translateY(-5px) scale(1.02);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
      background-color: var(--component-bg);
    }
    
    .circuit-thumbnail {
      height: 160px;
      background-color: var(--component-bg);
      background-size: cover;
      background-position: center;
      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--text-color);
      border-bottom: 1px solid var(--border-color);
    }
    
    .circuit-info {
      padding: 16px;
    }
    
    .circuit-info h3 {
      margin: 0 0 12px 0;
      color: var(--text-color);
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 600;
    }
    
    .circuit-info p {
      margin: 0 0 12px 0;
      color: var(--text-color);
      font-size: 14px;
      line-height: 1.5;
    }
    
    .circuit-meta {
      display: flex;
      justify-content: space-between;
      color: var(--text-color);
      opacity: 0.7;
      font-size: 13px;
      margin-bottom: 12px;
    }
    
    .circuit-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .tag {
      background-color: var(--component-bg);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      color: var(--text-color);
      transition: background-color 0.2s;
    }
    
    .tag:hover {
      background-color: var(--highlight-color);
      color: #fff;
    }
    
    .circuit-detail {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      background-color: var(--bg-color);
    }
    
    .back-button {
      background-color: transparent;
      border: none;
      padding: 8px 0;
      cursor: pointer;
      color: var(--highlight-color);
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 500;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      transition: color 0.2s;
    }
    
    .back-button:hover {
      color: #fff;
      text-decoration: underline;
    }
    
    .circuit-detail-container {
      max-width: 900px;
      margin: 0 auto;
    }
    
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .detail-header h2 {
      margin: 0;
      color: var(--text-color);
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 600;
    }
    
    .detail-actions {
      display: flex;
      gap: 12px;
    }
    
    .detail-actions button {
      padding: 10px 16px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    
    .use-button {
      background-color: var(--component-bg);
      color: var(--text-color);
    }
    
    .use-button:hover {
      background-color: var(--highlight-color);
      color: #fff;
    }
    
    .download-button {
      background-color: var(--component-bg);
      color: var(--text-color);
    }
    
    .download-button:hover {
      background-color: var(--highlight-color);
      color: #fff;
    }
    
    .like-button {
      background-color: var(--component-bg);
      color: var(--text-color);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .like-button:hover {
      background-color: #e53935;
      color: #fff;
    }
    
    .like-button.liked {
      background-color: #e53935;
      color: #fff;
    }
    
    .detail-info {
      margin-bottom: 24px;
      line-height: 1.6;
      color: var(--text-color);
    }
    
    .detail-info strong {
      color: var(--text-color);
      opacity: 0.9;
    }
    
    .detail-description {
      margin: 24px 0;
      padding: 20px;
      background-color: var(--secondary-bg);
      border-radius: 8px;
      line-height: 1.6;
      border: 1px solid var(--border-color);
    }
    
    .detail-description h3 {
      margin-top: 0;
      color: var(--text-color);
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 600;
    }
    
    .detail-tags {
      margin: 16px 0;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .circuit-preview {
      margin: 24px 0;
      padding: 20px;
      background-color: var(--secondary-bg);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }
    
    .circuit-preview h3 {
      margin-top: 0;
      color: var(--text-color);
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 600;
    }
    
    .circuit-preview img {
      max-width: 100%;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      margin-top: 16px;
    }
    
    .circuit-code {
      margin: 24px 0;
    }
    
    .circuit-code h3 {
      margin-top: 0;
      color: var(--text-color);
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 600;
    }
    
    .circuit-code pre {
      background-color: var(--component-bg);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      line-height: 1.5;
      margin-top: 16px;
      border: 1px solid var(--border-color);
    }
    
    .circuit-comments {
      margin: 24px 0;
    }
    
    .circuit-comments h3 {
      margin-top: 0;
      color: var(--text-color);
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 600;
      margin-bottom: 16px;
    }
    
    .comments-list {
      margin-bottom: 24px;
    }
    
    .comment {
      border-bottom: 1px solid var(--border-color);
      padding: 16px 0;
    }
    
    .comment:last-child {
      border-bottom: none;
    }
    
    .comment-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    
    .comment-author {
      font-weight: 600;
      color: var(--text-color);
    }
    
    .comment-date {
      color: var(--text-color);
      opacity: 0.7;
      font-size: 13px;
    }
    
    .comment-text {
      color: var(--text-color);
      line-height: 1.5;
    }
    
    .comment-form {
      margin-top: 24px;
      border-top: 1px solid var(--border-color);
      padding-top: 24px;
    }
    
    .comment-form textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      resize: vertical;
      min-height: 100px;
      margin-bottom: 12px;
      font-family: inherit;
      background-color: var(--component-bg);
      color: var(--text-color);
    }
    
    .comment-form textarea:focus {
      border-color: var(--highlight-color);
      outline: none;
      box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
    }
    
    .comment-form button {
      padding: 10px 16px;
      background-color: var(--component-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    
    .comment-form button:hover {
      background-color: var(--highlight-color);
      color: #fff;
    }
    
    .upload-form {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: var(--bg-color);
      padding: 24px;
      border-radius: 8px;
      width: 550px;
      max-width: 90%;
      box-shadow: 0 5px 30px rgba(0, 0, 0, 0.5);
      z-index: 1100;
      border: 3px solid #0b0b0b;
      color: var(--text-color);
    }
    
    .form-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .form-title {
      margin: 0;
      color: var(--text-color);
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 600;
      font-size: 20px;
    }
    
    .form-field {
      margin-bottom: 16px;
    }
    
    .form-field label {
      display: block;
      margin-bottom: 8px;
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 500;
      color: var(--text-color);
    }
    
    .form-field input,
    .form-field textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-family: inherit;
      font-size: 14px;
      background-color: var(--component-bg);
      color: var(--text-color);
      transition: border-color 0.2s;
    }
    
    .form-field input:focus,
    .form-field textarea:focus {
      border-color: var(--highlight-color);
      outline: none;
      box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
    }
    
    .form-field textarea {
      resize: vertical;
      min-height: 100px;
    }
    
    #circuit-code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      min-height: 150px;
    }
    
    form button[type="submit"] {
      padding: 12px 16px;
      background-color: var(--component-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
      width: 100%;
      margin-top: 16px;
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    
    form button[type="submit"]:hover {
      background-color: var(--highlight-color);
      color: #fff;
    }
    
    .loading-indicator {
      grid-column: 1 / -1;
      text-align: center;
      padding: 40px;
      color: var(--text-color);
      font-family: "Pixelify Sans", sans-serif;
      font-style: italic;
    }
    
    .no-results {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px;
      color: var(--text-color);
      background-color: var(--secondary-bg);
      border-radius: 8px;
      border: 1px solid var(--border-color);
      box-shadow: 2px 2px 4px rgba(0, 0, 0, 1);
      font-family: "Pixelify Sans", sans-serif;
    }
    
    .repository-button {
      background-color: var(--component-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 10px 16px;
      font-family: "Pixelify Sans", sans-serif;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .repository-button:hover {
      background-color: var(--highlight-color);
      color: #fff;
    }
  `;

  document.head.appendChild(style);
}

export class CircuitRepositoryController {
  private container: HTMLElement;
  private modalElement: HTMLElement | null = null;
  private circuitGridElement: HTMLElement | null = null;
  private detailViewElement: HTMLElement | null = null;
  private uploadFormElement: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private currentUserId: string = "unknown-user";

  private currentCircuits: CircuitEntry[] = [];
  private currentTab: "browse" | "my-circuits" | "shared-me" = "browse";
  public selectedCircuitId: string | null = null;

  constructor(
    private repositoryService: CircuitRepositoryService,
    private verilogConverter: VerilogCircuitConverter,
    containerElement: HTMLElement
  ) {
    this.container = containerElement;
    this.initializeUI();
    const userInfo = localStorage.getItem("user_info");

    const user = userInfo ? JSON.parse(userInfo) : { id: "unknown-user" };
    this.currentUserId = user.id || user._id; 
  }

  public open(): void {
    if (this.modalElement) {
      this.modalElement.style.display = "flex";
      this.loadCircuits();
    }
  }

  public close(): void {
    if (this.modalElement) {
      this.modalElement.style.display = "none";
    }
  }

  private initializeUI(): void {
    addRepositoryStyles();

    const repoUI = createRepositoryUI();
    this.container.appendChild(repoUI);
    this.modalElement = repoUI;

    this.circuitGridElement = document.getElementById("circuit-grid");
    this.detailViewElement = document.getElementById("circuit-detail");
    this.uploadFormElement = document.getElementById("upload-form");
    this.searchInput = document.getElementById("circuit-search") as HTMLInputElement;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const closeBtn = document.getElementById("repo-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.close());
    }

    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && this.modalElement) {
        this.close();
      }
    });

    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", e => {
        const tabName = (e.currentTarget as HTMLElement).getAttribute("data-tab");
        if (tabName === "shared-me" || tabName === "browse" || tabName === "my-circuits" ) {
          this.switchTab(tabName);
        }
      });
    });

    if (this.searchInput) {

      let debounceTimeout: number | null = null;
      
      this.searchInput.addEventListener("input", e => {
        const query = (e.target as HTMLInputElement).value;
        
        
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        
        debounceTimeout = setTimeout(() => {
          this.searchCircuits(query);
        }, 200) as unknown as number;
      });
    
    }

    const uploadBtn = document.getElementById("upload-circuit-btn");
    if (uploadBtn) {
      uploadBtn.addEventListener("click", () => this.showUploadForm());
    }

    const closeUploadBtn = document.getElementById("close-upload-form");
    if (closeUploadBtn) {
      closeUploadBtn.addEventListener("click", () => this.hideUploadForm());
    }

    const uploadForm = document.getElementById("circuit-upload-form");
    if (uploadForm) {
      uploadForm.addEventListener("submit", e => this.handleUploadSubmit(e));
    }

    const backBtn = document.getElementById("back-to-grid-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => this.showCircuitGrid());
    }
  }

  private async loadCircuits(): Promise<void> {
    if (!this.circuitGridElement) return;

    this.circuitGridElement.innerHTML = `<div class="loading-indicator">Loading circuits...</div>`;

    try {
      const allCircuits = await this.repositoryService.getCircuits();

      if (this.currentTab === "browse") {
        // Public devreleri getir
        const allCircuits = await this.repositoryService.getCircuits();
        // Sadece public ve kullanıcının sahip olmadığı devreleri filtrele
        this.currentCircuits = allCircuits.filter(c => {
          const isPublic = c.isPublic === true;
          let isNotOwned = false;
          if (typeof c.userId === "object" && c.userId !== null) {
            isNotOwned = c.userId._id !== this.currentUserId;
          } else {
            isNotOwned = c.userId !== this.currentUserId;
          }
          return isPublic && isNotOwned;
        });
      } else if (this.currentTab === "my-circuits") {
        // Kullanıcının kendi devrelerini filtrele
        const allCircuits = await this.repositoryService.getCircuits();
        this.currentCircuits = allCircuits.filter(c => {
          if (typeof c.userId === "object" && c.userId !== null) {
            return c.userId._id === this.currentUserId;
          } else {
            return c.userId === this.currentUserId;
          }
        });
      } else if (this.currentTab === "shared-me") {
        // Kullanıcı ile paylaşılan devreleri getir
        this.currentCircuits = await this.repositoryService.getSharedCircuits();
      }
      this.renderCircuitGrid();
    } catch (error) {
      console.error("Failed to load circuits:", error);
      this.circuitGridElement.innerHTML = `
        <div class="no-results">
          <h3>Error Loading Circuits</h3>
          <p>Sorry, we couldn't load the circuit repository. Please try again later.</p>
        </div>
      `;
    }
  }
  private showShareModal(circuitId: string, circuitName: string): void {
    
    const shareModal = document.createElement("div");
    shareModal.className = "share-modal";
    shareModal.innerHTML = `
      <div class="share-modal-content">
        <div class="share-modal-header">
          <h3>Share "${circuitName}"</h3>
          <button class="close-share-modal">×</button>
        </div>
        <div class="share-modal-body">
          <p>Enter the username of the person you want to share this circuit with:</p>
          <input type="text" id="share-username" placeholder="Username" class="share-input">
          <div class="share-error" style="color: red; display: none;"></div>
          <button id="share-submit-btn" class="share-button">Share</button>
        </div>
      </div>
    `;

    document.body.appendChild(shareModal);

    
    const closeBtn = shareModal.querySelector(".close-share-modal");
    closeBtn?.addEventListener("click", () => {
      shareModal.remove();
    });

    const shareBtn = shareModal.querySelector("#share-submit-btn");
    shareBtn?.addEventListener("click", async () => {
      const usernameInput = shareModal.querySelector("#share-username") as HTMLInputElement;
      const username = usernameInput.value.trim();
      const errorElement = shareModal.querySelector(".share-error") as HTMLElement;

      if (!username) {
        errorElement.textContent = "Please enter a username";
        errorElement.style.display = "block";
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/circuits/${circuitId}/share`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify({ username }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to share circuit");
        }

        
        shareModal.remove();
        alert(`Circuit successfully shared with ${username}`);
      } catch (error) {
        
        errorElement.textContent = "Failed to share circuit";
        errorElement.style.display = "block";
      }
    });
  }
  private renderCircuitGrid(): void {
    if (!this.circuitGridElement) return;

    if (this.currentCircuits.length === 0) {
      this.circuitGridElement.innerHTML = `
        <div class="no-results">
          <h3>No circuits found</h3>
          <p>${this.currentTab === "browse" ? "There are no circuits in the repository yet." : "You haven't created any circuits yet."}</p>
        </div>
      `;
      return;
    }

    this.circuitGridElement.innerHTML = "";

    this.currentCircuits.forEach(circuit => {
      const card = this.createCircuitCard(circuit);
      this.circuitGridElement?.appendChild(card);
    });
  }

  private createCircuitCard(circuit: CircuitEntry): HTMLElement {
    if (!circuit.id) {
      console.error("Circuit ID is missing");
      return document.createElement("div");
    }

    const card = document.createElement("div");
    card.className = "circuit-card";

    if (circuit.isShared) {
      card.classList.add("shared");
    }

    if (circuit.isPublic) {
      card.classList.add("public");
    }

    card.dataset.circuitId = circuit.id;

    card.innerHTML = `
      <div class="circuit-thumbnail" ${circuit.thumbnailUrl ? `style="background-image: url('${circuit.thumbnailUrl}')"` : ""}>
        ${!circuit.thumbnailUrl ? "No Preview" : ""}
        <div class="circuit-actions">
          <button class="view-circuit" title="View details">📄</button>
          <button class="delete-circuit" title="Delete circuit">🗑️</button>
        </div>
      </div>
      <div class="circuit-info">
        <h3>${circuit.name || circuit.title || "Untitled Circuit"}</h3>
        <p>${this.truncateText(circuit.description || "", 100)}</p>
        <div class="circuit-meta">
          <span>by ${circuit.authorName || "Unknown"}</span>
          <span>❤️ ${circuit.likes || 0}</span>
          <span>⬇️ ${circuit.downloads || 0}</span>
        </div>
        <div class="circuit-tags">
          ${(circuit.tags || []).map(tag => `<span class="tag">${tag}</span>`).join("")}
        </div>
      </div>
    `;

    
    const viewButton = card.querySelector(".view-circuit");
    if (viewButton) {
      viewButton.addEventListener("click", e => {
        e.stopPropagation();
        this.viewCircuitDetails(circuit.id);
      });
    }

    
    const deleteButton = card.querySelector(".delete-circuit");
    if (deleteButton) {
      deleteButton.addEventListener("click", async e => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete "${circuit.name || "Untitled Circuit"}"?`)) {
          try {
            await this.repositoryService.deleteCircuit(circuit.id);
            card.remove();
            alert("Circuit deleted successfully!");

            
            this.loadCircuits();
          } catch (error) {
            console.error("Failed to delete circuit:", error);
            alert("Failed to delete circuit. Please try again.");
          }
        }
      });
    }

    
    card.addEventListener("click", () => this.viewCircuitDetails(circuit.id));

    return card;
  }

  private async viewCircuitDetails(circuitId: string): Promise<void> {
    if (!this.detailViewElement || !this.circuitGridElement) return;

    if (!circuitId) {
      console.error("Invalid circuit ID");
      alert("Invalid circuit ID. Please try again.");
      return;
    }

    try {
      const circuit = await this.repositoryService.getCircuitById(circuitId);
      this.selectedCircuitId = circuitId;

      this.renderCircuitDetail(circuit);

      this.circuitGridElement.style.display = "none";
      this.detailViewElement.style.display = "block";
    } catch (error) {
      console.error("Failed to load circuit details:", error);
      alert("Error loading circuit details. Please try again.");
    }
  }
  private async toggleCircuitPublicStatus(circuit: CircuitEntry): Promise<void> {
    try {
      // Görünürlüğü tersine çevir
      const newVisibility = !circuit.isPublic;
      
      await this.repositoryService.updateCircuitVisibility(circuit.id, newVisibility);
      
      // Devre objesini güncelle
      circuit.isPublic = newVisibility;
      
      // Detay sayfasını yeniden render et
      this.renderCircuitDetail(circuit);
      
      alert(`Circuit is now ${newVisibility ? 'public' : 'private'}`);
    } catch (error) {
      console.error('Error toggling circuit visibility:', error);
      alert('Failed to update circuit visibility. Please try again.');
    }
  }
  private renderCircuitDetail(circuit: CircuitEntry): void {
    if (!this.detailViewElement) return;

    const detailContainer = document.getElementById("detail-container");
    if (!detailContainer) return;

    const userInfo = localStorage.getItem("user_info");
    const user = userInfo ? JSON.parse(userInfo) : null;
    const isOwner =
      user &&
      ((typeof circuit.userId === "object" && circuit.userId?._id === user.id) ||
        circuit.userId === user.id);

    const isLiked = false;

    const isPublic = circuit.isPublic || false;

    detailContainer.innerHTML = `
      <div class="detail-header">
        <h2>${circuit.name || circuit.title || "Untitled Circuit"}</h2>
        <div class="detail-actions">
          <button class="use-button" id="use-circuit-btn">Use This Circuit</button>
          <button class="download-button" id="download-circuit-btn">Download</button>
          <button class="like-button ${isLiked ? "liked" : ""}" id="like-circuit-btn">
            ❤️ ${circuit.likes || 0}
          </button>
          ${isOwner ? `<button id="share-circuit-btn" class="secondary-button">Share</button>` : ""}
                    <button id="public-toggle-btn" class="visibility-button ${isPublic ? "public" : "private"}">
            ${isPublic ? "🌎 Public" : "🔒 Private"}
          </button>
          <button class="delete-button" id="delete-circuit-btn">Delete</button>
        </div>
      </div>
      
      <div class="detail-info">
        <p><strong>Author:</strong> ${circuit.authorName || "Unknown"}</p>
        <p><strong>Created:</strong> ${new Date(circuit.dateCreated).toLocaleDateString()} | <strong>Updated:</strong> ${new Date(circuit.dateModified).toLocaleDateString()}</p>
        <p><strong>Downloads:</strong> ${circuit.downloads || 0} | <strong>Likes:</strong> ${circuit.likes || 0}</p>
        
        <div class="detail-tags">
          <strong>Tags:</strong>
          ${(circuit.tags || []).map(tag => `<span class="tag">${tag}</span>`).join("")}
        </div>
      </div>
      
      <div class="detail-description">
        <h3>Description</h3>
        <p>${circuit.description || "No description available"}</p>
      </div>
      
      <div class="circuit-preview">
        <h3>Circuit Preview</h3>
        ${
          circuit.thumbnailUrl
            ? `<img src="${circuit.thumbnailUrl}" alt="${circuit.name || circuit.title || "Untitled Circuit"}">`
            : "<p>No preview available</p>"
        }
      </div>
      
      <div class="circuit-code">
        <h3>Verilog Code</h3>
        <pre>${circuit.verilogCode || "No Verilog code available"}</pre>
      </div>
      
      <div class="circuit-comments">
        <h3>Comments (${(circuit.comments || []).length})</h3>
        
        <div class="comments-list">
          ${
            (circuit.comments || []).length === 0
              ? "<p>No comments yet. Be the first to comment!</p>"
              : (circuit.comments || [])
                  .map(
                    comment => `
                <div class="comment">
                  <div class="comment-header">
                    <span class="comment-author">${comment.authorName || "Unknown"}</span>
                    <span class="comment-date">${new Date(comment.date).toLocaleDateString()}</span>
                  </div>
                  <div class="comment-text">${comment.text}</div>
                </div>
              `
                  )
                  .join("")
          }
        </div>
        
        <div class="comment-form">
          <textarea id="comment-text" placeholder="Add a comment..."></textarea>
          <button id="post-comment-btn">Post Comment</button>
        </div>
      </div>
    `;

    this.setupDetailViewEvents(circuit);
  }

  private setupDetailViewEvents(circuit: CircuitEntry): void {
    const useBtn = document.getElementById("use-circuit-btn");
    if (useBtn) {
      useBtn.addEventListener("click", () => this.useCircuit(circuit));
    }

    const downloadBtn = document.getElementById("download-circuit-btn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => this.downloadCircuit(circuit));
    }

    const likeBtn = document.getElementById("like-circuit-btn");
    if (likeBtn) {
      likeBtn.addEventListener("click", () => this.likeCircuit(circuit.id));
    }

    const publicToggleBtn = document.getElementById("public-toggle-btn");
    if (publicToggleBtn) {
      publicToggleBtn.addEventListener("click", () => this.toggleCircuitPublicStatus(circuit));
    }

    const shareBtn = document.getElementById("share-circuit-btn");
    if (shareBtn) {
      shareBtn.addEventListener("click", () =>
        this.showShareModal(circuit.id, circuit.name || "Untitled Circuit")
      );
    }

    
    const deleteBtn = document.getElementById("delete-circuit-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        if (confirm(`Are you sure you want to delete "${circuit.name || "Untitled Circuit"}"?`)) {
          try {
            await this.repositoryService.deleteCircuit(circuit.id);

            
            this.showCircuitGrid();

            
            this.loadCircuits();

            alert("Circuit deleted successfully!");
          } catch (error) {
            console.error("Failed to delete circuit:", error);
            alert("Failed to delete circuit. Please try again.");
          }
        }
      });
    }

    
    const commentBtn = document.getElementById("post-comment-btn");
    const commentText = document.getElementById("comment-text") as HTMLTextAreaElement;
    if (commentBtn && commentText) {
      commentBtn.addEventListener("click", () => {
        if (commentText.value.trim()) {
          this.addComment(circuit.id, commentText.value);
          commentText.value = "";
        }
      });
    }
  }

  private switchTab(tab: "browse" | "my-circuits" | "shared-me"): void {
    this.currentTab = tab;

    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(t => {
      if (t.getAttribute("data-tab") === tab) {
        t.classList.add("active");
      } else {
        t.classList.remove("active");
      }
    });

    this.loadCircuits();

    this.showCircuitGrid();
  }

  private showCircuitGrid(): void {
    if (!this.circuitGridElement || !this.detailViewElement) return;

    this.detailViewElement.style.display = "none";
    this.circuitGridElement.style.display = "grid";
    this.selectedCircuitId = null;
  }

  
private async searchCircuits(query: string): Promise<void> {
  if (!this.circuitGridElement) return;
  
  
  this.circuitGridElement.innerHTML = `<div class="loading-indicator">Searching circuits...</div>`;
  
  if (query.trim() === "") {
    
    return this.loadCircuits();
  }

  try {
    
    const searchResults = await this.repositoryService.searchCircuits(query);
    
    
    if (this.currentTab === "my-circuits") {
      
      this.currentCircuits = searchResults.filter(c => {
        if (typeof c.userId === "object" && c.userId !== null) {
          return c.userId._id === this.currentUserId;
        } else {
          return c.userId === this.currentUserId;
        }
      });
    } else {
      
      this.currentCircuits = searchResults.filter(c => {
        
        const isPublic = c.isPublic === true;
        
        
        let isNotOwned = false;
        if (typeof c.userId === "object" && c.userId !== null) {
          isNotOwned = c.userId._id !== this.currentUserId;
        } else {
          isNotOwned = c.userId !== this.currentUserId;
        }
        
        return isPublic && isNotOwned;
      });
    }

    
    this.renderCircuitGrid();
    
    
    if (this.currentCircuits.length === 0) {
      this.circuitGridElement.innerHTML = `
        <div class="no-results">
          <h3>No matches found</h3>
          <p>No circuits matching "${query}" were found.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error("Search failed:", error);
    this.circuitGridElement.innerHTML = `
      <div class="no-results">
        <h3>Search Failed</h3>
        <p>Sorry, we couldn't complete your search. Please try again later.</p>
      </div>
    `;
  }
}

  private showUploadForm(): void {
    if (this.uploadFormElement) {
      this.uploadFormElement.style.display = "block";
    }
  }

  private hideUploadForm(): void {
    if (this.uploadFormElement) {
      this.uploadFormElement.style.display = "none";

      const form = document.getElementById("circuit-upload-form") as HTMLFormElement;
      if (form) form.reset();
    }
  }
private async handleUploadSubmit(e: Event): Promise<void> {
  e.preventDefault();
  if (!this.uploadFormElement) return;

  const formData = new FormData(this.uploadFormElement as HTMLFormElement);
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const verilogCode = formData.get("verilogCode") as string;
  const tags = (formData.get("tags") as string).split(",").map(tag => tag.trim());

  
  const isPublic = formData.get("isPublic") === "on" || true; 

  try {
    const newCircuit = await this.repositoryService.uploadCircuit({
      name: title,
      description,
      userId: this.currentUserId,
      authorName: "Current User",
      tags,
      verilogCode,
      thumbnailUrl: undefined,
      components: [],
      wires: [],
      sharedWith: [],
      isPublic: isPublic, 
    });

    
    this.loadCircuits();
    this.currentCircuits.unshift(newCircuit);
    this.hideUploadForm();
  } catch (error) {
    console.error("Upload failed:", error);
    alert("Failed to upload circuit. Please try again.");
  }
}

  private async useCircuit(circuit: CircuitEntry): Promise<void> {
    try {
      
      const token = localStorage.getItem("auth_token");
      if (!token) {
        alert("You must be logged in to use this circuit");
        return;
      }

      const response = await fetch(`${apiBaseUrl}/api/circuits/${circuit.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch circuit: ${response.statusText}`);
      }

      const circuitData = await response.json();
      console.log("Fetched circuit data:", circuitData);

      
      const circuitBoard = this.verilogConverter.circuitBoard;
      circuitBoard.clearCircuit();

      const componentMap = new Map<string, Component>();
      const portMap = new Map<string, Port>();

      if (circuitData.components && circuitData.components.length > 0) {
        for (const compData of circuitData.components) {
          const component = circuitBoard.createComponentByType(
            compData.type,
            compData.state.position
          );

          if (component) {
            component.setState(compData.state);

            componentMap.set(compData.id, component);

            component.inputs.forEach((port, index) => {
              const portId = compData.inputs?.[index]?.id || `${compData.id}-input-${index}`;
              portMap.set(portId, port);
            });

            component.outputs.forEach((port, index) => {
              const portId = compData.outputs?.[index]?.id || `${compData.id}-output-${index}`;
              portMap.set(portId, port);
            });

            circuitBoard.addComponent(component);
          }
        }

        if (circuitData.wires && circuitData.wires.length > 0) {
          for (const wireData of circuitData.wires) {
            const sourcePort = portMap.get(wireData.start?.portId);
            const targetPort = portMap.get(wireData.end?.portId);

            if (sourcePort && targetPort) {
              console.log(`Creating wire from ${wireData.start.portId} to ${wireData.end.portId}`);

              const wire = new Wire(sourcePort);
              const connected = wire.connect(targetPort);

              if (connected) {
                circuitBoard.addWire(wire);
              } else {
                console.warn(
                  `Failed to connect wire from ${wireData.start.portId} to ${wireData.end.portId}`
                );
              }
            } else {
              console.warn(
                `Missing ports for wire: source=${wireData.start?.portId}, target=${wireData.end?.portId}`
              );
            }
          }
        } else {
          console.log("No wires to create in the circuit data");
        }

        circuitBoard.simulate();
        circuitBoard.draw();

        this.close();
        alert(`Circuit "${circuit.name || circuit.title || "Untitled"}" loaded successfully!`);
      } else {
        if (circuit.verilogCode) {
          const success = this.verilogConverter.importVerilogCode(circuit.verilogCode);
          if (success) {
            this.close();
            alert(
              `Circuit "${circuit.name || circuit.title || "Untitled"}" loaded from Verilog code!`
            );
            return;
          }
        }

        alert("The circuit appears to be empty. No components to load.");
      }
    } catch (error) {
      console.error("Failed to load circuit:", error);
      alert("Failed to load circuit. Please try again.");
    }
  }
  private async downloadCircuit(circuit: CircuitEntry): Promise<void> {
    try {
      await this.repositoryService.downloadCircuit(circuit.id);

      const blob = new Blob([circuit.verilogCode], { type: "text/plain" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${circuit.name.replace(/\s+/g, "_")}.v`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download circuit. Please try again.");
    }
  }

  private async likeCircuit(circuitId: string): Promise<void> {
    try {
      await this.repositoryService.likeCircuit(circuitId);

      this.viewCircuitDetails(circuitId);
    } catch (error) {
      console.error("Like operation failed:", error);
    }
  }

  private async addComment(circuitId: string, text: string): Promise<void> {
    try {
      const comment = {
        authorId: this.currentUserId,
        authorName: "Current User",
        text: text.trim(),
      };

      await this.repositoryService.addComment(circuitId, comment);

      this.viewCircuitDetails(circuitId);
    } catch (error) {
      console.error("Comment failed:", error);
      alert("Failed to add comment. Please try again.");
    }
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }
}
