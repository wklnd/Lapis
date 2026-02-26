// ─── Global Search Class ───────────────────────────────────────────────────────────────
import { allFiles } from "./filetree";

export class GlobalSearch {
  constructor(readTextFile, handleOpenFile) {
    this.readTextFile = readTextFile;
    this.openFile = handleOpenFile;
    this.searchOverlay = document.getElementById("search-overlay");
    this.searchInput = document.getElementById("global-search-input");
    this.searchResults = document.getElementById("search-result");

    this.init();
  }

  init() {
    // --- Keyboard shortcuts ---
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && e.code == "KeyF") {
        e.preventDefault();
        this.openGlobalSearch();
      }

      if (e.key === "Escape") {
        this.closeGlobalSearch();
      }
    });

    // --- Close overlay on background click ---
    this.searchOverlay.addEventListener("click", (e) => {
      if (e.target === this.searchOverlay) {
        this.closeGlobalSearch();
      }
    });

    // --- Real-time search input ---
    this.searchInput.addEventListener("input", async (e) => {
      const query = e.target.value.trim();
      alert("Input event fired! Query: " + query);

      if (!query) {
        this.searchResults.innerHTML =
          "<div style='padding:10px;color:#888'>No search query</div>";
        console.log("Query empty, cleared results");
        this.resetSearch();
        return;
      }

      try {
        
        this.searchResults.innerHTML = "";
        await this.searchVault(query, allFiles);
      } catch (err) {
        alert("Error in search: " + err);
      }
    });
  }

  // --- Open overlay and focus input ---
  openGlobalSearch() {
    this.searchOverlay.style.display = "flex";
    this.searchInput.focus();
  }

  // --- Close overlay and reset input/results ---
  closeGlobalSearch() {
    this.searchOverlay.style.display = "none";
    this.resetSearch();
  }

  // --- Clear input and show default placeholder ---
  resetSearch() {
    this.searchInput.value = "";
    this.searchResults.innerHTML =
      "<div style='padding:10px;color:#888'>No search query</div>";
  }

  escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

renderSingleFileResult(file, matches) {
  const fileDiv = document.createElement("div");
  fileDiv.classList.add("search-file");
  fileDiv.dataset.path = file.path;
  fileDiv.style.cursor = "pointer";

  fileDiv.addEventListener("click", () => {
    this.openFile(file.path, null);
    this.closeGlobalSearch();
  });

  fileDiv.innerHTML = `
    <div>${file.name}</div>
    <div style="font-size:12px;color:#888;">${file.path}</div>
  `;

  matches.forEach(match => {
    const matchDiv = document.createElement("div");
    matchDiv.style.paddingLeft = "10px";
    matchDiv.style.fontSize = "14px";
    matchDiv.innerHTML = `${match.lineNumber}: ${match.text}`;
    fileDiv.appendChild(matchDiv);
  });

  this.searchResults.appendChild(fileDiv);
}

  // --- Search all files for matching lines ---
  async searchVault(query, allFiles) {
  const lowerQuery = query.toLowerCase();
  const escapedQuery = this.escapeRegExp(query);
  const regex = new RegExp(`(${escapedQuery})`, "gi");

  let foundAny = false;

  for (const file of allFiles) {
    try {
      const content = await this.readTextFile(file.path);
      const lines = content.split("\n");
      const matches = [];

      lines.forEach((line, i) => {
        if (line.toLowerCase().includes(lowerQuery)) {
          matches.push({
            lineNumber: i + 1,
            text: line.replace(regex, '<span class="highlight">$1</span>')
          });
        }
      });

      if (matches.length > 0) {
        foundAny = true;
        this.renderSingleFileResult(file, matches);
      }

    } catch (err) {
      console.error("Failed reading file:", file.path);
    }
  }

  if (!foundAny) {
    this.searchResults.innerHTML =
      "<div style='padding:10px;color:#888'>No results found</div>";
  }
}

  // --- Render search results into overlay ---
  renderResults(results, query = "") {
    this.searchResults.innerHTML = "";

    if (results.length === 0) {
      const noResultsDiv = document.createElement("div");
      noResultsDiv.textContent = "No results found";
      noResultsDiv.style.padding = "10px";
      noResultsDiv.style.color = "#888";
      this.searchResults.appendChild(noResultsDiv);
      return;
    }

    results.forEach(file => {
      const fileDiv = document.createElement("div");
      fileDiv.classList.add("search-file");
      fileDiv.dataset.path = file.path;
      fileDiv.style.cursor = "pointer";
      fileDiv.addEventListener("click", () => {
        this.openFile(file.path, null);
        this.closeGlobalSearch();
      });

      fileDiv.innerHTML = `
        <div>${file.filename}</div>
        <div style="font-size:12px;color:#888;">${file.path}</div>
      `;

      // Render each matched line with highlighted query
      file.matches.forEach(match => {
        const matchDiv = document.createElement("div");
        matchDiv.style.paddingLeft = "10px";
        matchDiv.style.fontSize = "14px";
        const escapedQuery = this.escapeRegExp(query);
        const regex = new RegExp(`\\b(${escapedQuery})\\b`, "gi");

        const highlightedLine = match.text.replace(
        regex,
        '<span class="highlight">$1</span>'
        );

        matchDiv.innerHTML =
          `${match.lineNumber}: ${highlightedLine}`;

        fileDiv.appendChild(matchDiv);
      });
      this.searchResults.appendChild(fileDiv);
    });
  }
}
