// Toast Notification Setup
const toast = document.createElement('div');
toast.className = 'toast';
document.body.appendChild(toast);

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// MediaPipe Setup
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const cursor = document.getElementById('cursor');
const statusText = document.querySelector('.status');

let isPinching = false;
let screenWidth = window.innerWidth;
let screenHeight = window.innerHeight;

// Smooth cursor movement variables
let targetX = screenWidth / 2;
let targetY = screenHeight / 2;
let currentX = screenWidth / 2;
let currentY = screenHeight / 2;
const smoothingFactor = 0.2; // Adjust between 0.1 (slower, smoother) and 0.9 (faster, jittery)

// Resizing
window.addEventListener('resize', () => {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
});

function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// Animation loop for smooth cursor
function updateCursor() {
    // Interpolate
    currentX += (targetX - currentX) * smoothingFactor;
    currentY += (targetY - currentY) * smoothingFactor;
    
    // Make cursor visible if not already
    if (cursor.style.display === 'none' || cursor.style.display === '') {
        cursor.style.display = 'block';
        statusText.style.display = 'none'; // Hide initializing text
    }

    cursor.style.left = `${currentX}px`;
    cursor.style.top = `${currentY}px`;

    // Trigger hover checks based on smoothed position
    triggerHover(currentX, currentY);

    requestAnimationFrame(updateCursor);
}
requestAnimationFrame(updateCursor);

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Draw the camera image onto the canvas (mirrored by CSS)
    canvasCtx.drawImage(
        results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // Draw landmarks
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS,
                           {color: '#a78bfa', lineWidth: 3});
            drawLandmarks(canvasCtx, landmarks, {color: '#f472b6', lineWidth: 2, radius: 3});
        }

        // Get the first hand
        const hand = results.multiHandLandmarks[0];
        
        // Landmark 8 is Index Finger Tip, Landmark 4 is Thumb Tip
        const indexTip = hand[8];
        const thumbTip = hand[4];
        
        // Calculate target screen coordinates
        // Using (1 - x) because the visual output is mirrored
        targetX = (1 - indexTip.x) * screenWidth;
        targetY = indexTip.y * screenHeight;

        // Check distance for pinch (click mechanism)
        const dist = getDistance(indexTip, thumbTip);
        
        // Threshold for pinching
        if (dist < 0.05) {
            if (!isPinching) {
                isPinching = true;
                cursor.classList.add('clicking');
                triggerClick(currentX, currentY);
            }
        } else {
            if (isPinching) {
                isPinching = false;
                cursor.classList.remove('clicking');
                releaseClick();
            }
        }
    }
    canvasCtx.restore();
}

let hoveredElement = null;

function getElementAtCursor(x, y) {
    // Hide cursor temporarily to grab the element underneath
    cursor.style.visibility = 'hidden';
    const el = document.elementFromPoint(x, y);
    cursor.style.visibility = 'visible';
    return el;
}

function triggerHover(x, y) {
    const el = getElementAtCursor(x, y);
    
    if (el) {
        const interactive = el.closest('.interactive');
        if (interactive !== hoveredElement) {
            if (hoveredElement) {
                hoveredElement.classList.remove('hovered');
            }
            if (interactive) {
                interactive.classList.add('hovered');
            }
            hoveredElement = interactive;
        }
    } else {
        if (hoveredElement) {
            hoveredElement.classList.remove('hovered');
            hoveredElement = null;
        }
    }
}

function triggerClick(x, y) {
    const el = getElementAtCursor(x, y);
    if (el) {
        const interactive = el.closest('.interactive');
        if (interactive) {
            interactive.classList.add('active');
            
            // Dispatch synthetic click
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y
            });
            interactive.dispatchEvent(clickEvent);
            
            const actionName = interactive.querySelector('h2').innerText;
            showToast(`${actionName} Activated!`);
        }
    }
}

function releaseClick() {
    document.querySelectorAll('.interactive').forEach(el => el.classList.remove('active'));
}

// Initialize MediaPipe Hands
const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1, // 0 for lighter weight, 1 for better accuracy
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});
hands.onResults(onResults);

// Initialize Camera
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 640,
  height: 480
});

// Start camera and handle permissions
camera.start()
    .then(() => {
        console.log("Camera started successfully");
    })
    .catch((err) => {
        console.error("Camera error:", err);
        statusText.textContent = "Camera access denied or unavailable.";
        statusText.style.color = "#ef4444";
    });

// Add standard mouse support for testing on non-camera devices
document.addEventListener('mousemove', (e) => {
    if (cursor.style.display === 'none' || cursor.style.display === '') {
        // Only use mouse if hand tracking hasn't taken over
        targetX = e.clientX;
        targetY = e.clientY;
    }
});
