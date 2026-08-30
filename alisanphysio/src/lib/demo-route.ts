export const DEMO_REQUEST_HEADER = "x-alisan-demo-request";
export const DEMO_PATH = "/demo";

export function isDemoRequestPath(pathname: string): boolean {
  return pathname === DEMO_PATH || pathname === `${DEMO_PATH}/`;
}
