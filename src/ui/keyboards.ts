export const PHONE_CC_QUICK_KEYBOARD = {
  reply_markup: {
    keyboard: [
      [{ text: '🇵🇹 Portugal (+351)' }],
      [{ text: '🇧🇷 Brasil (+55)' }],
      [{ text: 'Outro país' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
}

export const OUT_OF_FLOW_KEYBOARD = {
  reply_markup: {
    keyboard: [[{ text: 'Reiniciar' }, { text: 'Continuar' }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
}

export const WELCOME_KEYBOARD = {
  reply_markup: {
    keyboard: [[{ text: 'Cancelar' }, { text: 'Começar' }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
}
