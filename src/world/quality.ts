export interface QualityProfile {
  pixelRatioCap: number;
  shadowSize: number;
  foliageCount: number;
  textureClass: 'mobile' | 'desktop';
  waterHighlights: boolean;
  showPeople: boolean;
  showDockMarkers: boolean;
  cameraFov: number;
  cameraDistance: number;
}

export function chooseQuality(isMobile: boolean, reducedMotion: boolean): QualityProfile {
  return {
    pixelRatioCap: isMobile ? 1.25 : 1.7,
    shadowSize: isMobile ? 512 : 1024,
    foliageCount: isMobile ? 8 : 14,
    textureClass: isMobile ? 'mobile' : 'desktop',
    waterHighlights: !isMobile && !reducedMotion,
    showPeople: true,
    showDockMarkers: true,
    cameraFov: isMobile ? 66 : 54,
    cameraDistance: isMobile ? 12 : 11,
  };
}
