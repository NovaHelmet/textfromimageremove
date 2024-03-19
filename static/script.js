document.addEventListener('DOMContentLoaded', function() {
  const imageInput = document.getElementById('imageInput');
  const fileLabel = document.getElementById('fileLabel');
  const imageCanvas = document.getElementById('imageCanvas');
  const removeButton = document.getElementById('removeButton');
  const downloadLink = document.getElementById('downloadLink');
  const loadingOverlay = document.querySelector('.loading-overlay');
  const errorMessage = document.getElementById('errorMessage');
  const ctx = imageCanvas.getContext('2d');
  let img = new Image();
  let uploadedFilename = '';
  let currentSelection = null;
  let isDrawing = false;
  let resultImageDrawn = false;

  function resetState() {
    img = new Image();
    uploadedFilename = '';
    currentSelection = null;
    isDrawing = false;
    resultImageDrawn = false;
    fileLabel.textContent = 'Drag and Drop';
    imageCanvas.width = 0;
    imageCanvas.height = 0;
    ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    downloadLink.style.display = 'none';
    removeButton.style.display = 'block';
    imageInput.value = ''; // Reset the input value to allow selecting the same file again
  }

  imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image')) {
      alert('Please select a valid image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = function(event) {
      img.onload = function() {
        imageCanvas.width = img.width;
        imageCanvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      }
      img.onerror = function() {
        alert('Failed to load the image.');
      }
      img.src = event.target.result;
      fileLabel.textContent = file.name;
    }
    reader.readAsDataURL(file);
    uploadFile(file);
  });

  function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    fetch('/upload', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      uploadedFilename = data.filename;
    })
    .catch(error => {
      handleFetchError(error);
    });
  }

  function handleFetchError(error) {
    alert('Failed to upload the image.');
    console.error('Upload Error:', error);
    location.reload(); // Reload the page if there's an error
  }

  function getPosition(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function startDrawing(event) {
    if (resultImageDrawn) return; // Don't allow drawing on the result image
    const pos = getPosition(imageCanvas, event);
    currentSelection = { x: pos.x, y: pos.y, width: 0, height: 0 };
    isDrawing = true;
  }

  function draw(event) {
    if (!isDrawing) return;
    if (resultImageDrawn) return; // Don't allow drawing on the result image
    const pos = getPosition(imageCanvas, event);
    currentSelection.width = pos.x - currentSelection.x;
    currentSelection.height = pos.y - currentSelection.y;
    redraw();
  }

  function finishDrawing() {
    if (!isDrawing) return;
    if (resultImageDrawn) return; // Don't allow drawing on the result image
    isDrawing = false;
  }

  function redraw() {
    ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    ctx.drawImage(img, 0, 0);
    if (currentSelection) {
      ctx.beginPath();
      ctx.rect(currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height);
      ctx.strokeStyle = 'red';
      ctx.stroke();
    }
  }

  imageCanvas.addEventListener('mousedown', startDrawing);
  imageCanvas.addEventListener('mousemove', draw);
  imageCanvas.addEventListener('mouseup', finishDrawing);

  imageCanvas.addEventListener('touchstart', function(event) {
    event.preventDefault();
    startDrawing(event.touches[0]);
  });
  imageCanvas.addEventListener('touchmove', function(event) {
    event.preventDefault();
    draw(event.touches[0]);
  });
  imageCanvas.addEventListener('touchend', function(event) {
    event.preventDefault();
    finishDrawing();
  });

  removeButton.addEventListener('click', function() {
    if (uploadedFilename && currentSelection !== null) {
      showLoadingAnimation();
      fetch('/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: uploadedFilename,
          coordinates: currentSelection
        })
      })
      .then(response => response.json())
      .then(data => {
        hideLoadingAnimation();
        const cleanedImage = new Image();
        cleanedImage.onload = function() {
          ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
          ctx.drawImage(cleanedImage, 0, 0);
          createDownloadLink(data.result_filename);
          resultImageDrawn = true; // Set the flag indicating that the result image has been drawn
        }
        cleanedImage.src = `/uploads/${data.result_filename}`;
        currentSelection = null;
      })
      .catch(error => {
        alert('Failed to process the image.');
        console.error('Process Error:', error);
        location.reload(); // Reload the page if there's an error
      });
    }
  });

  function showLoadingAnimation() {
    loadingOverlay.style.display = 'flex';
  }

  function hideLoadingAnimation() {
    loadingOverlay.style.display = 'none';
  }

  function createDownloadLink(filename) {
    downloadLink.href = `/uploads/${filename}`;
    downloadLink.download = generateRandomWord() + '.png';
    downloadLink.textContent = 'Download Result';
    downloadLink.style.display = 'block';
    removeButton.style.display = 'none'; // Hide the Remove Selected Area button
  }

  function generateRandomWord() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    let word = '';
    for (let i = 0; i < 5; i++) {
      word += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return word;
  }

  downloadLink.addEventListener('click', function() {
    location.reload(); // Reload the page after clicking the download link
  });

  // Reset the state when the "Choose Image" button is clicked again
  fileLabel.addEventListener('click', function() {
    resetState();
  });
});
