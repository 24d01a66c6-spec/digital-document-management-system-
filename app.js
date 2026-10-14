const form = document.getElementById("uploadForm");
const list = document.getElementById("documentList");
const search = document.getElementById("search");
const message = document.getElementById("message");

async function loadDocuments() {
  try {
    const response = await fetch("/api/documents?q=" + encodeURIComponent(search.value));
    const docs = await response.json();
    list.replaceChildren();
    if (!docs.length) { list.textContent = "No documents found."; return; }
    docs.forEach(doc => {
      const card = document.createElement("article"); card.className = "doc";
      const title = document.createElement("h3"); title.textContent = doc.title;
      const info = document.createElement("p");
      info.textContent = `${doc.category} • ${doc.originalName} • ${new Date(doc.uploadedAt).toLocaleString()}`;
      const link = document.createElement("a"); link.href = "/api/documents/" + encodeURIComponent(doc.id) + "/file";
      link.textContent = "Download";
      const remove = document.createElement("button"); remove.className = "delete"; remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        if (!confirm("Delete this document?")) return;
        const r = await fetch("/api/documents/" + encodeURIComponent(doc.id), { method: "DELETE" });
        if (r.ok) loadDocuments(); else alert("Could not delete document.");
      });
      card.append(title, info, link, remove); list.append(card);
    });
  } catch { list.textContent = "Could not load documents. Check that the server is running."; }
}

form.addEventListener("submit", async event => {
  event.preventDefault(); message.textContent = "Uploading...";
  try {
    const response = await fetch("/api/documents", { method: "POST", body: new FormData(form) });
    const result = await response.json();
    if (!response.ok) { message.textContent = result.error || "Upload failed."; return; }
    message.textContent = "Document uploaded successfully."; form.reset(); await loadDocuments();
  } catch { message.textContent = "Upload failed. Check the server connection."; }
});
search.addEventListener("input", loadDocuments);
loadDocuments();
