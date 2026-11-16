import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

export async function runAttachmentChecks({ origin, cdp, evaluate, waitFor, click, button, calls, errors, userDir, controls }) {
  await cdp('Page.navigate', { url: origin + '/tasks?view=all&task=2' })
  await waitFor('!!document.querySelector(".ht-attachments") && !Array.from(document.querySelectorAll(".ht-attachments button")).find(b => b.textContent === "+ Đính kèm tệp")?.disabled')
  assert(await evaluate('document.querySelector(".ht-attachments").innerText.includes("Chưa có tệp")'))
  const file = path.join(userDir, 'Bao cao.pdf'); fs.writeFileSync(file, '%PDF-1.7\nNoi dung kiem thu')
  async function upload() {
    const { root } = await cdp('DOM.getDocument')
    const { nodeId } = await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: '.ht-attachments input[type="file"]' })
    await cdp('DOM.setFileInputFiles', { nodeId, files: [file] })
  }
  await upload()
  await waitFor('document.querySelectorAll(".ht-attachments li").length === 1 && !document.querySelector(".ht-attachments input").disabled')
  const post = calls.find(c => c.route === '/tasks/2/attachments' && c.method === 'POST')
  assert(post)
  assert(Object.entries(post.headers).some(([k,v]) => k.toLowerCase() === 'content-type' && v.startsWith('multipart/form-data; boundary=')))
  assert(Object.entries(post.headers).some(([k,v]) => k.toLowerCase() === 'authorization' && v.startsWith('Bearer ')))
  assert(Object.entries(post.headers).some(([k,v]) => k.toLowerCase() === 'if-match' && /^"ht-\d+"$/.test(v)))
  await cdp('Page.reload')
  await waitFor('document.querySelectorAll(".ht-attachments li").length === 1 && !document.querySelector(".ht-attachments input").disabled')
  await click('.ht-attachment-name')
  await waitFor('!document.querySelector(".ht-attachments input").disabled')
  assert(calls.some(c => /\/attachments\/1\/download$/.test(c.route)))
  // Lỗi mạng/ghi DB giữ nguyên tệp đã có; người dùng có thể nạp lại rồi thử lại.
  controls.failUpload = true
  await upload()
  await waitFor('document.querySelector(".ht-attachments").innerText.includes("Kho tệp đang bận")')
  assert.equal(await evaluate('document.querySelectorAll(".ht-attachments li").length'), 1)
  await button('Tải dữ liệu mới')
  await waitFor('!document.querySelector(".ht-attachments input").disabled')
  await click('button[aria-label="Xóa tệp Bao cao.pdf"]')
  await button('Xóa tệp')
  await waitFor('document.querySelectorAll(".ht-attachments li").length === 0 && !document.querySelector(".ht-attachments input").disabled')
  const before = calls.filter(c => c.method === 'POST' && c.route.endsWith('/attachments')).length
  await evaluate(`(() => { const input=document.querySelector('.ht-attachments input'); const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(10*1024*1024+1)],'Qua lon.pdf'));input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true})); })()`)
  await waitFor('document.querySelector(".ht-attachments").innerText.includes("không vượt quá 10 MB")')
  assert.equal(calls.filter(c => c.method === 'POST' && c.route.endsWith('/attachments')).length, before)
  if (process.env.CORE_SCREENSHOT) {
    const shot = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(process.env.CORE_SCREENSHOT, Buffer.from(shot.data,'base64'))
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  assert(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
  assert.deepEqual(errors, [])
  console.log('PASS giao diện tệp: tải lên multipart, F5, tải xuống có JWT, lỗi/thử lại, xác nhận xóa, giới hạn dung lượng, mobile.')
}
