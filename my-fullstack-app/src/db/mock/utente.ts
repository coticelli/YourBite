export interface Utente {
    id: number;
    nome: string;
    cognome: string;
    email: string;
    password: string;
}

const utenti: Utente[] = [
    { id: 1, nome: 'Mario', cognome: 'Rossi', email: 'mario.rossi@example.com', password: 'password123' },
    { id: 2, nome: 'Luigi', cognome: 'Verdi', email: 'luigi.verdi@example.com', password: 'password456' },
    { id: 3, nome: 'Anna', cognome: 'Bianchi', email: 'anna.bianchi@example.com', password: 'password789' },
];

export const getUtenti = (): Utente[] => {
    return utenti;
};

export const getUtenteById = (id: number): Utente | undefined => {
    return utenti.find(utente => utente.id === id);
};

export const addUtente = (utente: Utente): void => {
    utenti.push(utente);
};

export const updateUtente = (id: number, updatedUtente: Utente): void => {
    const index = utenti.findIndex(utente => utente.id === id);
    if (index !== -1) {
        utenti[index] = { ...utenti[index], ...updatedUtente };
    }
};

export const deleteUtente = (id: number): void => {
    const index = utenti.findIndex(utente => utente.id === id);
    if (index !== -1) {
        utenti.splice(index, 1);
    }
};