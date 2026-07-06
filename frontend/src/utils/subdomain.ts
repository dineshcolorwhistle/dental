export const getSubdomain = () => {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // Ignore IP addresses and single-segment hosts like "localhost"
  if (parts.length <= 1 || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return undefined;
  }
  
  // If it's a localhost with a subdomain (e.g. smilelab.localhost)
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0];
  }

  // For staging/dev domains like dental.agentwhistle.com or smile.dental.agentwhistle.com
  if (hostname.endsWith('.agentwhistle.com')) {
    if (parts.length >= 4) {
      return parts[0];
    }
    return undefined;
  }
  
  // For standard domains like subdomain.dental.com
  if (parts.length >= 3) {
    return parts[0];
  }
  
  return undefined;
};
