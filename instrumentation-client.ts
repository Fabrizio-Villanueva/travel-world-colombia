import { initBotId } from 'botid/client/core'

// Vercel BotID: la server action del formulario de cotización se envía por
// POST a la propia página. Ver checkBotId() en app/contacto/actions.ts.
initBotId({
  protect: [{ path: '/contacto', method: 'POST' }],
})
