import React from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, DitherEffect } from '@react-three/postprocessing';

const DitherBackground = () => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: -1,
      background: 'linear-gradient(135deg, #000000 0%, #1a1a2e 50%, #16213e 100%)'
    }}>
      <Canvas>
        <EffectComposer>
          <DitherEffect />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default DitherBackground;