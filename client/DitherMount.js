import React from 'react';
import ReactDOM from 'react-dom';
import DitherBackground from './DitherBackground.js';

// Function to mount the dither background
window.initDitherBackground = function() {
  // Create container if it doesn't exist
  let container = document.getElementById('dither-background-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dither-background-container';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -10;
      pointer-events: none;
    `;
    document.body.insertBefore(container, document.body.firstChild);
  }

  // Mount React component
  ReactDOM.render(<DitherBackground />, container);
  console.log('✨ Dither background initialized');
};

// Function to stop animations (cleanup)
window.stopDitherBackground = function() {
  const container = document.getElementById('dither-background-container');
  if (container) {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
    console.log('🛑 Dither background stopped');
  }
};