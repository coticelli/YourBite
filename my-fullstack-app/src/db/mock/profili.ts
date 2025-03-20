export interface Profilo {
    id: number;
    nome: string;
    descrizione: string;
}

const profili: Profilo[] = [
    { id: 1, nome: "Profilo Amministratore", descrizione: "Accesso completo a tutte le funzionalità." },
    { id: 2, nome: "Profilo Utente", descrizione: "Accesso limitato alle funzionalità di base." },
    { id: 3, nome: "Profilo Ospite", descrizione: "Accesso solo in lettura a determinate sezioni." },
];

export const getProfili = (): Profilo[] => {
    return profili;
};

export const getProfiloById = (id: number): Profilo | undefined => {
    return profili.find(profilo => profilo.id === id);
};

export const addProfilo = (profilo: Profilo): void => {
    profili.push(profilo);
};

export const updateProfilo = (id: number, updatedProfilo: Profilo): boolean => {
    const index = profili.findIndex(profilo => profilo.id === id);
    if (index !== -1) {
        profili[index] = updatedProfilo;
        return true;
    }
    return false;
};

export const deleteProfilo = (id: number): boolean => {
    const index = profili.findIndex(profilo => profilo.id === id);
    if (index !== -1) {
        profili.splice(index, 1);
        return true;
    }
    return false;
};