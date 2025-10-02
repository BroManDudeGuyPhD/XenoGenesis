// Advanced Three.js Dither Background Effect with FBM and Bayer Matrix
class DitherEffect {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.animationId = null;
        this.time = 0;
        this.mouse = { x: 0.5, y: 0.5 };
        this.targetMouse = { x: 0.5, y: 0.5 };
        
        // Detect mobile devices (more comprehensive)
        this.isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone|Mobile|Tablet/i.test(navigator.userAgent) || 
                        ('ontouchstart' in window) || 
                        (navigator.maxTouchPoints > 0) ||
                        (window.innerWidth <= 768);
        
        // Configuration
        this.config = {
            waveSpeed: 0.02,        // Even slower for more contemplative feel
            waveFrequency: 2.5,     // Reduced frequency for larger patterns
            waveAmplitude: 0.4,     // Higher amplitude for more dramatic waves
            mouseRadius: 0.08,      // Tighter mouse interaction radius
            colorNum: 6,            // Number of dither colors
            pixelSize: 3.0          // Dither pixel size
        };
        
        // Click pulse system
        this.clickPulses = []; // Array to store active pulses
        this.maxPulses = 5;    // Maximum simultaneous pulses
        
        // Click and hold shadow system
        this.isMouseDown = false;
        this.holdStartTime = 0;
        this.holdPosition = { x: 0.5, y: 0.5 };
        this.holdEndTime = 0; // When mouse was released
        this.maxHoldRadius = 0; // Maximum radius reached during hold
        this.isDissipating = false; // Whether shadow is dissipating
        this.driftVelocity = { x: 0, y: 0 }; // Cloud drift direction
        this.driftPosition = { x: 0.5, y: 0.5 }; // Current drifting position
        
        this.init();
        this.setupMouseTracking();
    }
    
    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        
        // Camera setup
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: false,
            alpha: true 
        });
        
        // Simple approach: just use full viewport for mobile with extended coverage
        let width, height;
        
        if (this.isMobile) {
            // Mobile: Extended viewport coverage for full screen effect
            width = window.innerWidth + 40;
            height = window.innerHeight + 40;
        } else {
            // Desktop: Use container dimensions
            const containerRect = this.container.getBoundingClientRect();
            width = containerRect.width || window.innerWidth;
            height = containerRect.height || window.innerHeight;
        }
        
        this.renderer.setSize(width, height, false); // Always false - let us control canvas styling
        this.renderer.setPixelRatio(1); // Force pixel ratio to 1 for simplicity
        
        // Remove fallback logic that might be causing issues
        
        // Add to container or body (mobile gets body placement)
        if (this.isMobile) {
            // Mobile: Attach directly to body to avoid container constraints
            document.body.appendChild(this.renderer.domElement);
        } else {
            // Desktop: Use container
            this.container.appendChild(this.renderer.domElement);
        }
        
        // Smart canvas styling: aggressive for mobile, responsive for desktop
        this.canvas = this.renderer.domElement;
        this.canvas.style.pointerEvents = 'auto';
        this.canvas.style.display = 'block';
        
        if (this.isMobile) {
            // Mobile: Extended viewport coverage for full screen effect
            this.canvas.style.position = 'fixed';
            this.canvas.style.top = '-20px';
            this.canvas.style.left = '-20px';
            this.canvas.style.width = 'calc(100vw + 40px)';
            this.canvas.style.height = 'calc(100vh + 40px)';
            this.canvas.style.zIndex = '5'; // Above most content but below key UI
        } else {
            // Desktop: Use relative positioning to container
            this.canvas.style.position = 'absolute';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.zIndex = '5'; // Above most content but below key UI
        }
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        
        // Advanced vertex shader
        const vertexShader = `
            varying vec2 vUv;
            
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        // Advanced fragment shader with FBM and Bayer dithering
        const fragmentShader = `
            uniform float time;
            uniform vec2 resolution;
            uniform vec2 mouse;
            uniform float waveSpeed;
            uniform float waveFrequency;
            uniform float waveAmplitude;
            uniform float mouseRadius;
            uniform float colorNum;
            uniform float pixelSize;
            // Click pulse uniforms
            uniform float pulsePositions[10]; // 5 pulses x 2 coords (x,y,x,y,x,y,x,y,x,y)
            uniform float pulseRadii[5];
            uniform float pulseIntensities[5];
            // Hold shadow uniforms
            uniform vec2 holdPosition;
            uniform float holdRadius;
            uniform float holdIntensity;
            varying vec2 vUv;
            
            // Perlin noise functions (extracted from React component)
            vec4 mod289(vec4 x) { 
                return x - floor(x * (1.0/289.0)) * 289.0; 
            }
            
            vec4 permute(vec4 x) { 
                return mod289(((x * 34.0) + 1.0) * x); 
            }
            
            vec4 taylorInvSqrt(vec4 r) { 
                return 1.79284291400159 - 0.85373472095314 * r; 
            }
            
            vec2 fade(vec2 t) { 
                return t*t*t*(t*(t*6.0-15.0)+10.0); 
            }

            float cnoise(vec2 P) {
                vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
                vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
                Pi = mod289(Pi);
                vec4 ix = Pi.xzxz;
                vec4 iy = Pi.yyww;
                vec4 fx = Pf.xzxz;
                vec4 fy = Pf.yyww;
                vec4 i = permute(permute(ix) + iy);
                vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
                vec4 gy = abs(gx) - 0.5;
                vec4 tx = floor(gx + 0.5);
                gx = gx - tx;
                vec2 g00 = vec2(gx.x, gy.x);
                vec2 g10 = vec2(gx.y, gy.y);
                vec2 g01 = vec2(gx.z, gy.z);
                vec2 g11 = vec2(gx.w, gy.w);
                vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
                g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
                float n00 = dot(g00, vec2(fx.x, fy.x));
                float n10 = dot(g10, vec2(fx.y, fy.y));
                float n01 = dot(g01, vec2(fx.z, fy.z));
                float n11 = dot(g11, vec2(fx.w, fy.w));
                vec2 fade_xy = fade(Pf.xy);
                vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
                return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
            }

            // Fractal Brownian Motion (FBM) with 4 octaves
            const int OCTAVES = 4;
            float fbm(vec2 p) {
                float value = 0.0;
                float amp = 1.0;
                float freq = waveFrequency;
                for (int i = 0; i < OCTAVES; i++) {
                    value += amp * abs(cnoise(p));
                    p *= freq;
                    amp *= waveAmplitude;
                }
                return value;
            }

            // Pattern function with time-based flow
            float pattern(vec2 p) {
                vec2 p2 = p - time * waveSpeed;
                return fbm(p + fbm(p2)); 
            }
            
            // 8x8 Bayer matrix for professional dithering
            float bayerMatrix8x8[64] = float[64](
                0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
                32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
                8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0,  7.0/64.0, 55.0/64.0,
                40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
                2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
                34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
                10.0/64.0,58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0,57.0/64.0,  5.0/64.0, 53.0/64.0,
                42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
            );

            // Professional Bayer dithering function
            vec3 dither(vec2 uv, vec3 color) {
                vec2 scaledCoord = floor(uv * resolution / pixelSize);
                int x = int(mod(scaledCoord.x, 8.0));
                int y = int(mod(scaledCoord.y, 8.0));
                float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;
                float step = 1.0 / (colorNum - 1.0);
                color += threshold * step;
                float bias = 0.2;
                color = clamp(color - bias, 0.0, 1.0);
                return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
            }
            
            // CRT Effects (subtle and preserving)
            
            // Subtle barrel distortion for CRT curvature
            vec2 crtCurve(vec2 uv) {
                vec2 crt = uv * 2.0 - 1.0;
                vec2 offset = abs(crt.yx) / vec2(6.0, 4.0);
                crt = crt + crt * offset * offset;
                return crt * 0.5 + 0.5;
            }
            
            // Subtle scanlines
            float scanlines(vec2 uv) {
                float line = sin(uv.y * resolution.y * 0.7);
                return 1.0 - (line * line * 0.15); // Very subtle
            }
            
            // CRT vignette and edge darkening
            float crtVignette(vec2 uv) {
                vec2 d = abs(uv - 0.5) * 2.0;
                d = smoothstep(0.68, 1.2, d);
                return clamp(1.0 - dot(d, d), 0.0, 1.0);
            }
            
            // Subtle phosphor glow
            vec3 phosphorGlow(vec3 color, vec2 uv) {
                // Very subtle RGB separation for phosphor effect
                float r = color.r;
                float g = color.g * 0.98;
                float b = color.b * 0.96;
                return vec3(r, g, b);
            }
            
            // Click and hold dark shadow effect - more pixelated and cloud-like
            float holdShadowEffect(vec2 uv) {
                if (holdIntensity <= 0.0) return 0.0;
                
                vec2 centeredUv = uv - 0.5;
                centeredUv.x *= resolution.x / resolution.y;
                
                vec2 holdPos = holdPosition - 0.5;
                holdPos.x *= resolution.x / resolution.y;
                
                float dist = length(centeredUv - holdPos);
                
                // Multi-layered cloud-like noise for organic growth (very slow animation)
                vec2 noisePos = (centeredUv - holdPos) * 8.0;
                float cloudNoise1 = cnoise(noisePos + time * 0.04) * 0.5 + 0.5; // Slower: 0.08 -> 0.04
                float cloudNoise2 = cnoise(noisePos * 2.0 + time * 0.025) * 0.3 + 0.5; // Slower: 0.05 -> 0.025
                float cloudNoise3 = cnoise(noisePos * 4.0 + time * 0.06) * 0.2 + 0.5; // Slower: 0.12 -> 0.06
                
                // Combine noise layers for organic cloud shape
                float organicNoise = cloudNoise1 * cloudNoise2 * cloudNoise3;
                
                // Simpler, more effective cloud edge approach using fractal boundaries
                float baseRadius = holdRadius * 0.6; // Solid core
                float cloudRadius = holdRadius * (0.9 + organicNoise * 0.3); // Noise-modulated boundary
                
                // Core shadow with sharp falloff
                float coreShadow = 1.0 - smoothstep(0.0, baseRadius * 0.8, dist);
                
                // Main cloud body with organic edges
                float mainCloud = 1.0 - smoothstep(baseRadius, cloudRadius, dist);
                // Apply fractal noise to create natural cloud edges
                float edgeNoise = (cloudNoise1 * 0.5 + cloudNoise2 * 0.3 + cloudNoise3 * 0.2);
                mainCloud *= (0.4 + edgeNoise * 1.2); // Strong noise influence on edges
                
                // Soft outer wisps using turbulence
                float wispRadius = holdRadius * (1.1 + cloudNoise1 * 0.4);
                float wisps = 1.0 - smoothstep(cloudRadius * 0.9, wispRadius, dist);
                wisps *= pow(edgeNoise, 2.0) * 0.3; // Only where noise is concentrated
                
                // Combine layers with natural falloff
                float shadow = coreShadow + mainCloud * 0.8 + wisps;
                
                // Add additional feathering with fine noise details
                float featherNoise = cloudNoise3 * 0.2;
                shadow *= (0.8 + featherNoise);
                
                return shadow * holdIntensity * 2.5;  // Much darker - almost pure black
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                
                // Apply subtle CRT curvature (very gentle)
                vec2 crtUv = crtCurve(uv);
                
                // Check if we're outside the curved screen bounds
                if (crtUv.x < 0.0 || crtUv.x > 1.0 || crtUv.y < 0.0 || crtUv.y > 1.0) {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black outside screen
                    return;
                }
                
                vec2 centeredUv = crtUv - 0.5;
                centeredUv.x *= resolution.x / resolution.y;
                
                // Generate FBM pattern (unchanged - preserving your animation!)
                float f = pattern(centeredUv * 3.0);
                
                // Mouse interaction effect (unchanged - preserving your mouse effect!)
                vec2 mouseUv = mouse;
                vec2 mouseNDC = (mouseUv - 0.5);
                mouseNDC.x *= resolution.x / resolution.y;
                float mouseDist = length(centeredUv - mouseNDC);
                float mouseEffect = 1.0 - smoothstep(0.0, mouseRadius, mouseDist);
                
                // Dark cloud effect (unchanged - preserving your effect!)
                f -= 0.6 * mouseEffect;
                f = clamp(f, 0.0, 1.0);
                
                // More purple color palette
                vec3 neonPink = vec3(0.9, 0.1, 0.7);     // Slightly more purple pink
                vec3 deepPurple = vec3(0.5, 0.0, 0.9);   // Brighter purple
                vec3 darkPurple = vec3(0.3, 0.0, 0.6);   // More saturated dark purple
                vec3 almostBlack = vec3(0.1, 0.0, 0.2);  // Purple-tinted black
                
                // Color mixing based on pattern intensity (unchanged!)
                vec3 color1 = mix(almostBlack, darkPurple, f * 0.5);
                vec3 color2 = mix(deepPurple, neonPink, f);
                vec3 finalColor = mix(color1, color2, f);
                
                // Apply Bayer matrix dithering (unchanged!)
                finalColor = dither(gl_FragCoord.xy, finalColor);
                
                // Add extra darkness in mouse area - deeper black, more centered
                if (mouseDist < mouseRadius) {
                    float cloudIntensity = 1.0 - (mouseDist / mouseRadius);
                    // More intense curve for tighter, darker effect
                    cloudIntensity = pow(cloudIntensity, 1.5); // Sharper falloff
                    finalColor = mix(finalColor, almostBlack * 0.3, cloudIntensity * 0.9); // Deeper black
                }
                
                // Apply click and hold shadow (beneath mouse cloud)
                float holdShadow = holdShadowEffect(uv);
                
                // Pixelization effect around shadow edges
                if (holdShadow > 0.0) {
                    vec2 centeredUv = uv - 0.5;
                    centeredUv.x *= resolution.x / resolution.y;
                    
                    vec2 holdPos = holdPosition - 0.5;
                    holdPos.x *= resolution.x / resolution.y;
                    
                    float dist = length(centeredUv - holdPos);
                    
                    // Use organic noise to create natural, irregular boundaries
                    vec2 noisePos = centeredUv * 12.0 + time * 0.1;
                    float organicNoise = cnoise(noisePos) * 0.5 + 0.5;
                    float fineNoise = cnoise(noisePos * 3.0) * 0.3 + 0.5;
                    
                    // Create very soft, natural falloff with noise modulation
                    float baseFalloff = 1.0 - smoothstep(holdRadius * 0.5, holdRadius * 3.0, dist);
                    float noisyFalloff = baseFalloff * organicNoise * fineNoise;
                    
                    // Make the effect extremely subtle and organic
                    float edgeZone = pow(noisyFalloff, 2.0) * 0.6; // Very gentle
                    
                    if (edgeZone > 0.001) {
                        // Organic pixel sizing based on noise
                        float pixelSize = 1.5 + edgeZone * organicNoise * 3.0;
                        vec2 pixelPos = floor(gl_FragCoord.xy / pixelSize) * pixelSize;
                        float pixelNoise = fract(sin(dot(pixelPos, vec2(12.9898, 78.233))) * 43758.5453);
                        
                        // Very subtle noise blending
                        finalColor = mix(finalColor, vec3(pixelNoise * 0.05), edgeZone * 0.1);
                        
                        // Organic grid pattern that follows the noise
                        float gridSize = 2.0 + edgeZone * fineNoise * 4.0;
                        vec2 grid = mod(gl_FragCoord.xy + organicNoise * 2.0, gridSize);
                        float gridPattern = pow(smoothstep(gridSize * 0.3, gridSize * 0.7, grid.x), 2.0) * 
                                          pow(smoothstep(gridSize * 0.3, gridSize * 0.7, grid.y), 2.0);
                        
                        // Ultra-subtle grid effect
                        finalColor = mix(finalColor, finalColor * 0.9, gridPattern * edgeZone * 0.15);
                    }
                }
                
                finalColor = mix(finalColor, almostBlack * 0.05, holdShadow * 0.95); // Almost pure black shadow
                
                // Apply subtle CRT effects (new but gentle!)
                finalColor = phosphorGlow(finalColor, uv);
                finalColor *= scanlines(uv);
                finalColor *= crtVignette(uv);
                
                // Subtle edge fade to enhance the monitor effect
                float edgeFade = smoothstep(0.0, 0.08, uv.x) * smoothstep(0.0, 0.08, uv.y) * 
                               smoothstep(0.0, 0.08, 1.0 - uv.x) * smoothstep(0.0, 0.08, 1.0 - uv.y);
                finalColor *= edgeFade;
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;        // Create material with all uniforms
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                mouse: { value: new THREE.Vector2(0.5, 0.5) },
                waveSpeed: { value: this.config.waveSpeed },
                waveFrequency: { value: this.config.waveFrequency },
                waveAmplitude: { value: this.config.waveAmplitude },
                mouseRadius: { value: this.config.mouseRadius },
                colorNum: { value: this.config.colorNum },
                pixelSize: { value: this.config.pixelSize },
                // Click pulse uniforms
                pulsePositions: { value: [0,0,0,0,0,0,0,0,0,0] }, // 5 pulses x 2 coords
                pulseRadii: { value: [0,0,0,0,0] },
                pulseIntensities: { value: [0,0,0,0,0] },
                // Hold shadow uniforms
                holdPosition: { value: new THREE.Vector2(0.5, 0.5) },
                holdRadius: { value: 0.0 },
                holdIntensity: { value: 0.0 }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true
        });
        
        // Create geometry
        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
        
        // Store material reference for updates
        this.material = material;
        
        // Start animation immediately
        this.animate();
        
        // Handle resize
        this.handleResize = () => {
            let width, height;
            
            if (this.isMobile) {
                // Mobile: Extended viewport coverage for full screen effect
                width = window.innerWidth + 40;
                height = window.innerHeight + 40;
            } else {
                // Desktop: Use container dimensions
                const containerRect = this.container.getBoundingClientRect();
                width = containerRect.width || window.innerWidth;
                height = containerRect.height || window.innerHeight;
            }
            
            this.renderer.setSize(width, height, false);
            this.material.uniforms.resolution.value.set(width, height);
        };
        
        window.addEventListener('resize', this.handleResize);
        
        // Aggressive resize attempts for iPhone Safari
        const forceResize = () => this.handleResize();
        
        setTimeout(forceResize, 100);
        setTimeout(forceResize, 300);
        setTimeout(forceResize, 500);
        setTimeout(forceResize, 1000);
        
        // Listen for multiple mobile events
        window.addEventListener('orientationchange', () => {
            setTimeout(forceResize, 100);
            setTimeout(forceResize, 500);
        });
        
        window.addEventListener('load', forceResize);
        document.addEventListener('DOMContentLoaded', forceResize);
        
        // Visual viewport API for mobile browsers
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', forceResize);
        }
        
        // Start animation
        this.animate();
    }
    
    setupMouseTracking() {
        this.handleMouseMove = (event) => {
            // Simple approach - use window coordinates and convert
            this.targetMouse.x = event.clientX / window.innerWidth;
            this.targetMouse.y = 1.0 - (event.clientY / window.innerHeight) + 0.05; // Added offset to move effect slightly up
            
            // Debug log to check if mouse is being tracked
            // console.log('Mouse:', this.targetMouse.x.toFixed(2), this.targetMouse.y.toFixed(2));
        };
        
        // Click event for pulse effect
        this.handleClick = (event) => {
            // Remove any active hold shadow on click
            this.isMouseDown = false;
            console.log('Click - removed hold shadow');
        };
        
        // Mouse down - start growing shadow
        this.handleMouseDown = (event) => {
            this.isMouseDown = true;
            this.holdStartTime = this.time;
            // Use current smoothed mouse position for better centering
            this.holdPosition.x = this.mouse.x;
            this.holdPosition.y = this.mouse.y;
            console.log('Hold shadow started at:', this.holdPosition.x.toFixed(2), this.holdPosition.y.toFixed(2));
        };
        
        // Mouse up - stop growing shadow
        this.handleMouseUp = (event) => {
            this.isMouseDown = false;
            this.holdEndTime = this.time;
            this.maxHoldRadius = this.material.uniforms.holdRadius.value; // Store final radius
            this.isDissipating = true; // Start cloud dissipation
            
            // Initialize drift velocity based on current mouse movement or random
            this.driftVelocity.x = (Math.random() - 0.5) * 0.0003; // Random horizontal drift
            this.driftVelocity.y = (Math.random() - 0.5) * 0.0002 + 0.0001; // Slight upward bias
            this.driftPosition.x = this.holdPosition.x; // Start from current position
            this.driftPosition.y = this.holdPosition.y;
            
            console.log('Hold shadow ended - starting dissipation with drift');
        };
        
        // Add to window for broader coverage (desktop only for mouse tracking)
        if (!this.isMobile) {
            window.addEventListener('mousemove', this.handleMouseMove);
        }
        window.addEventListener('click', this.handleClick);
        
        // Only add shadow effects on desktop
        if (!this.isMobile) {
            window.addEventListener('mousedown', this.handleMouseDown);
            window.addEventListener('mouseup', this.handleMouseUp);
        }
        
        // Touch support for mobile (no finger tracking)
        this.handleTouchMove = (event) => {
            // Completely disabled - no finger tracking on mobile
        };
        
        this.handleTouchStart = (event) => {
            // Completely disabled - no finger tracking on mobile
        };
        
        this.handleTouchEnd = (event) => {
            // Completely disabled - no finger tracking on mobile
        };
        
        window.addEventListener('touchmove', this.handleTouchMove);
        window.addEventListener('touchstart', this.handleTouchStart);
        window.addEventListener('touchend', this.handleTouchEnd);
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        this.time += 0.016; // ~60fps
        
        // Smooth mouse movement (desktop only - static position on mobile)
        if (!this.isMobile) {
            this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.25; // Tighter tracking
            this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.25; // Tighter tracking
        }
        // Mobile keeps static mouse position (0.5, 0.5) - no finger tracking
        
        // Update all uniforms
        this.material.uniforms.time.value = this.time;
        this.material.uniforms.mouse.value.set(this.mouse.x, this.mouse.y);
        this.material.uniforms.waveSpeed.value = this.config.waveSpeed;
        this.material.uniforms.waveFrequency.value = this.config.waveFrequency;
        this.material.uniforms.waveAmplitude.value = this.config.waveAmplitude;
        this.material.uniforms.mouseRadius.value = this.config.mouseRadius;
        this.material.uniforms.colorNum.value = this.config.colorNum;
        this.material.uniforms.pixelSize.value = this.config.pixelSize;
        
        // Update click pulses
        this.updatePulses();
        
        // Update hold shadow animation (desktop only)
        if (!this.isMobile && this.isMouseDown) {
            const holdDuration = (this.time - this.holdStartTime) * 1000; // Convert to milliseconds
            const baseRadius = 0.3;
            const initialGrowthDuration = 2500; // Initial growth phase
            const continuousGrowthRate = 0.0003; // Slower: was 0.0008 - more gradual second phase
            
            if (holdDuration < initialGrowthDuration) {
                // Initial rapid growth phase with organic easing
                const progress = holdDuration / initialGrowthDuration;
                const organicProgress = progress * progress * (3.0 - 2.0 * progress); // Smoothstep easing
                this.material.uniforms.holdRadius.value = organicProgress * baseRadius;
                this.material.uniforms.holdIntensity.value = organicProgress * 1.0;
            } else {
                // Continuous slow growth phase with dramatic deceleration towards max
                const extraGrowthTime = holdDuration - initialGrowthDuration;
                const continuousGrowth = extraGrowthTime * continuousGrowthRate;
                const maxContinuousRadius = 0.8; // Allow larger growth
                
                // Much stronger deceleration - combination of exponential decay and distance-based slowdown
                const decayFactor = Math.exp(-extraGrowthTime * 0.0003); // Faster exponential decay
                const currentRadius = baseRadius + continuousGrowth * decayFactor;
                
                // Additional distance-based slowdown - slows dramatically as it approaches max
                const distanceToMax = maxContinuousRadius - currentRadius;
                const proximityFactor = Math.pow(distanceToMax / (maxContinuousRadius - baseRadius), 2); // Quadratic slowdown
                
                const finalRadius = Math.min(currentRadius * proximityFactor + currentRadius * (1 - proximityFactor) * 0.1, maxContinuousRadius);
                
                this.material.uniforms.holdRadius.value = finalRadius;
                this.material.uniforms.holdIntensity.value = 1.0; // Full darkness in continuous phase
            }
            this.material.uniforms.holdPosition.value.set(this.holdPosition.x, this.holdPosition.y);
        } else if (!this.isMobile && this.isDissipating) {
            // Cloud dissipation phase - gradual fade out with drift
            const dissipationTime = (this.time - this.holdEndTime) * 1000; // Time since mouse release
            const dissipationDuration = 4000; // 4 seconds to fully dissipate and drift
            
            if (dissipationTime < dissipationDuration) {
                const dissipationProgress = dissipationTime / dissipationDuration;
                // Exponential decay for natural cloud dissipation
                const fadeOutFactor = Math.exp(-dissipationProgress * 2.0); // Slower fade for longer drift
                
                // Update drift position - cloud drifts away slowly
                this.driftPosition.x += this.driftVelocity.x * (1.0 + dissipationProgress); // Accelerate drift over time
                this.driftPosition.y += this.driftVelocity.y * (1.0 + dissipationProgress);
                
                // Add some turbulence to the drift for more natural movement
                const turbulence = Math.sin(this.time * 2.0) * 0.00005;
                this.driftPosition.x += turbulence;
                this.driftPosition.y += turbulence * 0.5;
                
                // Keep drift within reasonable bounds
                this.driftPosition.x = Math.max(0.1, Math.min(0.9, this.driftPosition.x));
                this.driftPosition.y = Math.max(0.1, Math.min(0.9, this.driftPosition.y));
                
                this.material.uniforms.holdRadius.value = this.maxHoldRadius * (1.0 + dissipationProgress * 0.3); // More expansion while drifting
                this.material.uniforms.holdIntensity.value = fadeOutFactor; // Fade out intensity
                this.material.uniforms.holdPosition.value.set(this.driftPosition.x, this.driftPosition.y); // Use drifting position
            } else {
                // Dissipation complete
                this.isDissipating = false;
                this.material.uniforms.holdRadius.value = 0.0;
                this.material.uniforms.holdIntensity.value = 0.0;
            }
        } else {
            // No hold shadow (mobile or no active shadow)
            this.material.uniforms.holdRadius.value = 0.0;
            this.material.uniforms.holdIntensity.value = 0.0;
        }
        
        // Debug: log current mouse position every few frames
        if (Math.floor(this.time * 60) % 60 === 0) {
            console.log('Shader mouse:', this.mouse.x.toFixed(2), this.mouse.y.toFixed(2));
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    updatePulses() {
        // Update pulse animation
        for (let i = this.clickPulses.length - 1; i >= 0; i--) {
            const pulse = this.clickPulses[i];
            const elapsed = this.time - pulse.startTime;
            const duration = 2.0; // 2 seconds
            
            if (elapsed > duration) {
                // Remove expired pulse
                this.clickPulses.splice(i, 1);
            } else {
                // Update pulse properties
                const progress = elapsed / duration;
                pulse.radius = progress * 0.5; // Expand to 50% of screen
                pulse.intensity = 1.0 - (progress * progress); // Fade out with easing
            }
        }
        
        // Update shader uniforms
        const positions = new Array(10).fill(0);
        const radii = new Array(5).fill(0);
        const intensities = new Array(5).fill(0);
        
        for (let i = 0; i < Math.min(this.clickPulses.length, 5); i++) {
            const pulse = this.clickPulses[i];
            positions[i * 2] = pulse.x;
            positions[i * 2 + 1] = pulse.y;
            radii[i] = pulse.radius;
            intensities[i] = pulse.intensity;
        }
        
        this.material.uniforms.pulsePositions.value = positions;
        this.material.uniforms.pulseRadii.value = radii;
        this.material.uniforms.pulseIntensities.value = intensities;
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Remove event listeners from window
        if (!this.isMobile) {
            window.removeEventListener('mousemove', this.handleMouseMove);
        }
        window.removeEventListener('click', this.handleClick);
        window.removeEventListener('touchmove', this.handleTouchMove);
        window.removeEventListener('touchstart', this.handleTouchStart);
        window.removeEventListener('touchend', this.handleTouchEnd);
        window.removeEventListener('resize', this.handleResize);
        
        // Remove mouse event listeners only if they were added (desktop only)
        if (!this.isMobile) {
            window.removeEventListener('mousedown', this.handleMouseDown);
            window.removeEventListener('mouseup', this.handleMouseUp);
        }
        
        if (this.renderer && this.container.contains(this.renderer.domElement)) {
            this.container.removeChild(this.renderer.domElement);
        }
        
        // Cleanup Three.js objects
        if (this.scene) {
            this.scene.clear();
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// Global functions for integration
window.initDitherBackground = function(containerId) {
    const container = document.getElementById(containerId);
    if (container && !window.ditherEffect) {
        window.ditherEffect = new DitherEffect(container);
    }
};

window.stopDitherBackground = function() {
    if (window.ditherEffect) {
        window.ditherEffect.destroy();
        window.ditherEffect = null;
    }
};