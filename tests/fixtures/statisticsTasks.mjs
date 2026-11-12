export const statisticsNow = Date.parse('2026-11-12T03:00:00Z')
const task = (ma, more = {}) => ({ ma, maHocKy: 11, maMonHoc: 101, maNhiemVuCha: null, trangThai: 'NotStarted',
  hanHieuLuc: '2026-11-11T17:00:00Z', ngayHoanThanh: null, coNhiemVuCon: false, ...more })
export const statisticsTasks = [
  task(1),
  task(2, { trangThai: 'InProgress', hanHieuLuc: '2026-11-12T03:00:00Z' }),
  task(3, { trangThai: 'Completed', hanHieuLuc: '2026-10-01T05:00:00Z', ngayHoanThanh: '2026-10-01T04:00:00Z' }),
  task(4, { maMonHoc: 102, trangThai: 'Completed', hanHieuLuc: '2026-11-12T02:00:00Z', ngayHoanThanh: '2026-11-12T02:05:00Z' }),
  task(5, { maMonHoc: 102, trangThai: 'Completed', hanHieuLuc: null, ngayHoanThanh: '2026-11-12T02:00:00Z' }),
  task(6, { maMonHoc: 102, trangThai: 'Completed', hanHieuLuc: '2026-11-12T02:00:00Z' }),
  task(7, { maMonHoc: 103, hanHieuLuc: '2026-11-13T02:00:00Z' }),
  task(8, { coNhiemVuCon: true, trangThai: 'Completed', ngayHoanThanh: '2026-11-11T16:00:00Z' }),
  task(9, { maNhiemVuCha: 8, hanHoanThanh: null, maNhiemVuNguonHan: 8, trangThai: 'Completed', ngayHoanThanh: '2026-11-11T17:00:00Z' }),
  task(10, { maHocKy: 12, maMonHoc: null }),
  task(11, { maHocKy: null, maMonHoc: null }),
  task(12, { maMonHoc: null, hanHieuLuc: '2026-11-14T02:00:00Z' }),
  task(13, { maMonHoc: 102, trangThai: 'InProgress', hanHieuLuc: '2026-11-11T15:00:00Z' }),
  task(14, { coNhiemVuCon: true, trangThai: 'InProgress', hanHieuLuc: '2026-11-11T14:00:00Z' }),
  task(15, { maNhiemVuCha: 14, hanHieuLuc: '2026-11-11T14:00:00Z' }),
  task(16, { maNhiemVuCha: 14, trangThai: 'Completed', ngayHoanThanh: '2026-11-11T18:00:00Z' }),
  task(17, { maNhiemVuCha: 14, trangThai: 'Completed', ngayHoanThanh: '2026-11-11T16:00:00Z' }),
]

// Six main tasks across the account: five personal, one in the second semester.
// Nested steps must not become extra semester tasks.
export const personalAndSemesterTasks = [
  task(501, { maHocKy: 12, maMonHoc: null, trangThai: 'InProgress', coNhiemVuCon: true }),
  ...Array.from({ length: 5 }, (_, index) => task(502 + index, { maHocKy: null, maMonHoc: null })),
  task(601, { maHocKy: 12, maMonHoc: null, maNhiemVuCha: 501, trangThai: 'Completed', ngayHoanThanh: '2026-11-11T16:00:00Z' }),
  task(602, { maHocKy: 12, maMonHoc: null, maNhiemVuCha: 501 }),
]

// The normal task list hides this completed history; semester progress includes it.
export const tasksWithCompletedHistory = [
  ...personalAndSemesterTasks,
  ...Array.from({ length: 4 }, (_, index) => task(701 + index, {
    trangThai: 'Completed', ngayHoanThanh: '2026-11-11T16:00:00Z',
  })),
  task(705, { maHocKy: 12, maMonHoc: null, trangThai: 'Completed', ngayHoanThanh: '2026-11-11T16:00:00Z' }),
]
