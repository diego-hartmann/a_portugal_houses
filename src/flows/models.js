
// ---------------------------------------------------------------------------
// Configuração de Negócio
// ---------------------------------------------------------------------------

const REGION_SETS = {
  arrendar: [
    { label: 'Lisboa', value: 'lisboa' },
    { label: 'Viseu',  value: 'viseu'  }
  ],
  comprar: [
    { label: 'Lisboa',          value: 'lisboa' },
    { label: 'Viseu',           value: 'viseu'  },
    { label: 'Porto',           value: 'porto'  },
    { label: 'Braga',           value: 'braga'  },
    { label: 'Outras regiões',  value: 'outras-regioes' }
  ],
  ambos: [
    { label: 'Lisboa',          value: 'lisboa' },
    { label: 'Viseu',           value: 'viseu'  },
    { label: 'Porto',           value: 'porto'  },
    { label: 'Braga',           value: 'braga'  },
    { label: 'Outras regiões',  value: 'outras-regioes' }
  ]
};

const INTEREST_CODE = { arrendar: 'A', comprar: 'C', ambos: 'AC' };
const REGION_CODE   = { lisboa: 'L', viseu: 'V', porto: 'P', braga: 'B', 'outras-regioes': 'O' };


module.exports = {
    REGION_SETS,
    REGION_CODE,
    INTEREST_CODE
}