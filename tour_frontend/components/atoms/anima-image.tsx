"use client";

import React, { type ReactNode, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";

import { cn } from "@/lib/utils";

const VERTEX_SHADER = `
varying vec2 vUv;

void main()
{
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform sampler2D uTexture;
varying vec2 vUv;

uniform vec2 uResolution;
uniform float uProgress;
uniform vec3 uColor;

uniform vec2 uContainerRes;
uniform float uGridSize;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec2 squaresGrid(vec2 inUv) {
    float imageAspectX = 1.0;
    float imageAspectY = 1.0;

    float containerAspectX = uResolution.x / uResolution.y;
    float containerAspectY = uResolution.y / uResolution.x;

    vec2 ratio = vec2(
        min(containerAspectX / imageAspectX, 1.0),
        min(containerAspectY / imageAspectY, 1.0)
    );

    vec2 squareUvs = vec2(
        inUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
        inUv.y * ratio.y + (1.0 - ratio.y) * 0.5
    );

    return squareUvs;
}

void main() {
    float imageAspectX = uResolution.x / uResolution.y;
    float imageAspectY = uResolution.y / uResolution.x;

    float containerAspectX = uContainerRes.x / uContainerRes.y;
    float containerAspectY = uContainerRes.y / uContainerRes.x;

    vec2 ratio = vec2(
        min(containerAspectX / imageAspectX, 1.0),
        min(containerAspectY / imageAspectY, 1.0)
    );

    vec2 coverUvs = vec2(
        vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
        vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
    );

    vec2 squareUvs = squaresGrid(coverUvs);
    float baseGrid = max(uGridSize, 1.0);
    float gridSize = max(floor(uContainerRes.x / baseGrid), 1.0);
    vec2 grid = vec2(
      floor(squareUvs.x * gridSize) / gridSize,
      floor(squareUvs.y * gridSize) / gridSize
    );
    vec4 gridTexture = vec4(uColor, 0.0);

    vec4 textureColor = texture2D(uTexture, coverUvs);
    float height = 0.2;
    float progress = (1.0 + height) - (uProgress * (1.0 + height + height));

    float dist = 1.0 - distance(grid.y, progress);
    float clampedDist = smoothstep(height, 0.0, distance(grid.y, progress));
    float randDist = step(1.0 - height * random(grid), dist);
    dist = step(1.0 - height, dist);

    float rand = random(grid);
    float alpha = dist * (clampedDist + rand - 0.5 * (1.0 - randDist));
    alpha = max(0.0, alpha);
    gridTexture.a = alpha;

    textureColor.rgba *= step(progress, grid.y);
    gl_FragColor = vec4(mix(textureColor, gridTexture, gridTexture.a));
}
`;

interface AnimaImageProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  duration?: number;
  gridSize?: number;
  gridColor?: string;
}

export function AnimaImage({
  children,
  className,
  duration = 1.6,
  gridSize = 20,
  gridColor = "#242424",
  ...props
}: AnimaImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const image = container.querySelector("img");
    if (!image) return;

    gsap.registerPlugin(ScrollTrigger);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    camera.position.z = 1;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      precision: "highp",
      uniforms: {
        uTexture: new THREE.Uniform(new THREE.Texture()),
        uResolution: new THREE.Uniform(new THREE.Vector2(1, 1)),
        uContainerRes: new THREE.Uniform(new THREE.Vector2(1, 1)),
        uProgress: new THREE.Uniform(0),
        uGridSize: new THREE.Uniform(gridSize),
        uColor: new THREE.Uniform(new THREE.Color(gridColor)),
      },
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const render = () => {
      if (!renderer) return;
      renderer.render(scene, camera);
    };

    const resize = () => {
      if (!renderer) return;
      const bounds = container.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(bounds.width, bounds.height, false);
      material.uniforms.uContainerRes.value.set(bounds.width, bounds.height);
      render();
    };

    let texture: THREE.Texture | null = null;
    let scrollTween: gsap.core.Tween | null = null;
    canvas.style.opacity = "0";

    const loadTextureAndAnimate = () => {
      const imageWidth = image.naturalWidth || image.width;
      const imageHeight = image.naturalHeight || image.height;
      if (!imageWidth || !imageHeight) return;

      texture = new THREE.Texture(image);
      texture.needsUpdate = true;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      material.uniforms.uTexture.value = texture;
      material.uniforms.uResolution.value.set(imageWidth, imageHeight);

      resize();
      render();

      // Prevent showing the source image first, then a delayed canvas copy.
      image.style.opacity = "0";
      canvas.style.opacity = "1";

      scrollTween = gsap.to(material.uniforms.uProgress, {
        value: 1,
        duration,
        ease: "linear",
        onUpdate: render,
        scrollTrigger: {
          trigger: container,
          start: "top bottom",
          end: "bottom top",
          toggleActions: "play reset restart reset",
        },
      });
    };

    if (image.complete && image.naturalWidth > 0) {
      loadTextureAndAnimate();
    } else {
      image.addEventListener("load", loadTextureAndAnimate, { once: true });
    }

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    resizeObserver.observe(container);
    window.addEventListener("resize", resize, { passive: true });

    return () => {
      image.style.opacity = "";
      canvas.style.opacity = "";
      image.removeEventListener("load", loadTextureAndAnimate);
      window.removeEventListener("resize", resize);
      resizeObserver.disconnect();
      scrollTween?.scrollTrigger?.kill();
      scrollTween?.kill();
      texture?.dispose();
      geometry.dispose();
      material.dispose();
      renderer?.dispose();
    };
  }, [duration, gridColor, gridSize]);

  return (
    <div ref={containerRef} className={cn("relative block", className)} {...props}>
      {children}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}
