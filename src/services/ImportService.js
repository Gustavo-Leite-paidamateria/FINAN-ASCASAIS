export default class ImportService {
    /**
     * Parses OFX/QFX file content into an array of transaction objects
     * @param {string} content 
     */
    static parseOFX(content) {
        const transactions = [];
        // Regex to find transaction blocks
        const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
        let match;

        while ((match = trnRegex.exec(content)) !== null) {
            const block = match[1];
            
            const extract = (tag) => {
                const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
                const m = block.match(regex);
                return m ? m[1].trim() : null;
            };

            const type = extract('TRNTYPE');
            const dateStr = extract('DTPOSTED'); // YYYYMMDD...
            const amount = parseFloat(extract('TRNAMT'));
            const memo = extract('MEMO') || extract('NAME') || 'Sem descrição';
            const fitid = extract('FITID');

            if (dateStr && !isNaN(amount)) {
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                const date = new Date(`${year}-${month}-${day}T12:00:00Z`);

                transactions.push({
                    tipo: amount > 0 ? 'Receita' : 'Despesa',
                    valor: Math.abs(amount),
                    descricao: memo,
                    data: date.toISOString(),
                    fitid: fitid,
                    status: 'Pago'
                });
            }
        }

        return transactions;
    }

    /**
     * Detects potential duplicates in the database
     * @param {Array} newTransactions 
     * @param {Array} existingTransactions 
     */
    static detectDuplicates(newTransactions, existingTransactions) {
        return newTransactions.map(nt => {
            const ntDate = new Date(nt.data).toISOString().split('T')[0];
            
            const isDuplicate = existingTransactions.some(et => {
                const etDate = new Date(et.data).toISOString().split('T')[0];
                const sameDate = ntDate === etDate;
                const sameAmount = Math.abs(parseFloat(et.valor) - nt.valor) < 0.01;
                const similarDesc = et.descricao.toLowerCase().includes(nt.descricao.toLowerCase()) || 
                                   nt.descricao.toLowerCase().includes(et.descricao.toLowerCase());
                
                return sameDate && sameAmount && similarDesc;
            });

            return { ...nt, possibleDuplicate: isDuplicate };
        });
    }
}
