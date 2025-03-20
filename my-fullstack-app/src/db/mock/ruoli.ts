export interface Ruolo {
    id: number;
    nome: string;
    descrizione: string;
}

const ruoli: Ruolo[] = [
    { id: 1, nome: 'Admin', descrizione: 'Accesso completo a tutte le funzionalità' },
    { id: 2, nome: 'Editor', descrizione: 'Può modificare contenuti' },
    { id: 3, nome: 'Viewer', descrizione: 'Può visualizzare contenuti' },
];

export const getRuoli = (): Ruolo[] => {
    return ruoli;
};

export const getRuoloById = (id: number): Ruolo | undefined => {
    return ruoli.find(ruolo => ruolo.id === id);
};

export const addRuolo = (nuovoRuolo: Ruolo): void => {
    ruoli.push(nuovoRuolo);
};

export const updateRuolo = (id: number, aggiornamenti: Partial<Ruolo>): void => {
    const ruolo = getRuoloById(id);
    if (ruolo) {
        Object.assign(ruolo, aggiornamenti);
    }
};

export const deleteRuolo = (id: number): void => {
    const index = ruoli.findIndex(ruolo => ruolo.id === id);
    if (index !== -1) {
        ruoli.splice(index, 1);
    }
};