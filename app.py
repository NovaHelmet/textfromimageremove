from flask import Flask, render_template, request, jsonify, send_from_directory
import cv2
import numpy as np
import os
from werkzeug.utils import secure_filename
import pytesseract

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads/'

# Set the path to the Tesseract executable
pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'

# Define a function to remove text and objects from an image region
def remove_text_and_objects(img):
    # Convert the image to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply thresholding to create a binary image
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)

    # Use pytesseract to get bounding boxes around text
    custom_config = r'--oem 3 --psm 6'
    boxes = pytesseract.image_to_boxes(thresh, config=custom_config)
    
    # Create an empty single-channel mask
    mask = np.zeros_like(gray)

    # Draw rectangles around detected text regions on the mask
    for b in boxes.splitlines():
        b = b.split()
        x, y, w, h = int(b[1]), int(b[2]), int(b[3]), int(b[4])
        cv2.rectangle(mask, (x, img.shape[0] - y), (w, img.shape[0] - h), (255), -1)

    # Inpainting to blur or remove identified text or objects
    result = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)

    return result

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_image():
    file = request.files['file']
    filename = secure_filename(file.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)
    return jsonify({'filename': filename})

@app.route('/process', methods=['POST'])
def process_image():
    data = request.get_json()
    filename = data['filename']
    coordinates = data['coordinates']
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    img = cv2.imread(file_path)

    # Get the region to be inpainted
    x, y, width, height = int(coordinates['x']), int(coordinates['y']), int(coordinates['width']), int(coordinates['height'])
    region_of_interest = img[y:y+height, x:x+width]

    # Remove text and objects from the region
    inpainted_region = remove_text_and_objects(region_of_interest)

    # Replace the inpainted region in the original image
    img[y:y+height, x:x+width] = inpainted_region

    result_filename = f'processed_{filename}'
    result_path = os.path.join(app.config['UPLOAD_FOLDER'], result_filename)
    cv2.imwrite(result_path, img)
    
    return jsonify({'result_filename': result_filename})

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0')
