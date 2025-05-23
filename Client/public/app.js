document.getElementById('scrapeForm').addEventListener('submit', async function(e) { 
    e.preventDefault();
    
    const postUrl = document.getElementById('postUrl').value;
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<div class="loading">⏳ Fetching comments...</div>';
    
    try {
      // Scrape comments
      const scrapeResponse = await fetch('http://localhost:3001/api/scrape-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postUrl })
      });

      const scrapeData = await scrapeResponse.json();

      if (!scrapeData.success) {
        throw new Error(scrapeData.error || 'Failed to scrape comments');
      }

      // Display comments
      let html = `<h3>📝 Comments (${scrapeData.comments.length})</h3><ul>`;
      scrapeData.comments.slice(0, 20).forEach(comment => {
        html += `<li><strong>${comment.username}:</strong> ${comment.text}</li>`;
      });
      html += `</ul>`;

      // Add save button
      html += `
        <button id="saveCsv" class="download-btn">
          💾 Save CSV Locally (${scrapeData.comments.length} comments)
        </button>
      `;

      resultsDiv.innerHTML = html;

      // Add event listener to save CSV
      document.getElementById('saveCsv').addEventListener('click', async () => {
        try {
          const saveResponse = await fetch('http://localhost:3001/api/export-comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comments: scrapeData.comments })
          });

          const saveData = await saveResponse.json();

          if (!saveData.success) {
            throw new Error('Failed to save CSV file');
          }

          resultsDiv.innerHTML += `<p class="success">✅ File saved at: ${saveData.filePath}</p>`;

        } catch (error) {
          resultsDiv.innerHTML += `<p class="error">❌ Saving failed: ${error.message}</p>`;
        }
      });

    } catch (error) {
      resultsDiv.innerHTML = `<p class="error">❌ Error: ${error.message}</p>`;
    }
});
