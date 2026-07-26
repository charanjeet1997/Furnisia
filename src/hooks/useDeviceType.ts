import { useState, useEffect } from 'react';

export type DeviceType = 'phone' | 'tablet' | 'desktop';

export interface DeviceInfo {
  device: DeviceType;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
}

function calculateDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return { device: 'desktop', isPhone: false, isTablet: false, isDesktop: true, isTouch: false };
  }

  const width = window.innerWidth;
  const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  const ua = navigator.userAgent;

  const isMobileUA = /iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTabletUA = /iPad|Android(?!.*Mobile)|Tablet/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let device: DeviceType = 'desktop';

  if (isMobileUA || (width <= 768 && isTouch)) {
    device = 'phone';
  } else if (isTabletUA || (width > 768 && width <= 1024 && isTouch)) {
    device = 'tablet';
  } else {
    device = 'desktop';
  }

  return {
    device,
    isPhone: device === 'phone',
    isTablet: device === 'tablet',
    isDesktop: device === 'desktop',
    isTouch: Boolean(isTouch),
  };
}

export function useDeviceType(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => calculateDeviceInfo());

  useEffect(() => {
    function handleResize() {
      setDeviceInfo(calculateDeviceInfo());
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return deviceInfo;
}
