import { toBoardCamera, toSnapshotUrl } from './home.mapper';

describe('board camera', () => {
  it('reads the local and the TLS address of a board', () => {
    const camera = toBoardCamera(
      {
        id: 'b-1',
        name: 'Board',
        type: 'vantage',
        ip: 'http://192.168.178.196:3180,https://192.168.178.196:3181',
        state: { connected: true },
      },
      { numCams: 3 },
    );
    expect(camera).toEqual({
      calibration: null,
      boardId: 'b-1',
      name: 'Board',
      connected: true,
      cams: 3,
      localUrl: 'http://192.168.178.196:3180',
      directUrl: 'https://192-168-178-196.b-1.autodarts.direct:3181',
    });
  });

  it('falls back to the board type for the camera count and ignores odd addresses', () => {
    const camera = toBoardCamera(
      { id: 'b-2', type: 'lens', ip: 'javascript:alert(1)', state: {} },
      null,
    );
    expect(camera).toMatchObject({
      cams: 1,
      localUrl: null,
      directUrl: null,
      connected: false,
    });
  });

  it('builds snapshot urls only from relative paths', () => {
    expect(toSnapshotUrl({ url: '/img/abc.jpg' })).toBe(
      'https://boards.ws.autodarts.com/img/abc.jpg',
    );
    expect(toSnapshotUrl({ url: 'https://evil.example/x.jpg' })).toBeNull();
  });
});
