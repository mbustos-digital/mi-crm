const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_23_qeSIefcroRVovHosH68fccOWudjyhEEMQ9urQEwyDDY4OqyKHM19OK9fwlNUJiQ/exec'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  try {
    if (req.method === 'POST') {
      // POST: reenviar el body completo como JSON a Apps Script.
      // Code.v2.gs parsea e.postData.contents directamente, sin decodeURIComponent.
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'follow',
      })
      const text = await response.text()
      try {
        const data = JSON.parse(text)
        return res.status(200).json(data)
      } catch {
        const snippet = text.substring(0, 300).replace(/<[^>]*>/g, ' ').trim()
        return res.status(500).json({ error: `Error del servidor: ${snippet || 'respuesta vacía'}` })
      }
    }

    // GET: pasar los query params tal cual.
    // Code.v2.gs ya NO usa decodeURIComponent, así que codificación simple basta.
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(req.query)) {
      if (v !== undefined && v !== null) params.append(k, v)
    }
    const url = `${APPS_SCRIPT_URL}?${params.toString()}`

    const response = await fetch(url, { redirect: 'follow' })
    const text = await response.text()

    try {
      const data = JSON.parse(text)
      res.status(200).json(data)
    } catch {
      const snippet = text.substring(0, 300).replace(/<[^>]*>/g, ' ').trim()
      res.status(500).json({ error: `Error del servidor: ${snippet || 'respuesta vacía'}` })
    }
  } catch (err) {
    res.status(500).json({ error: 'Error al conectar con Google Sheets: ' + err.message })
  }
}
