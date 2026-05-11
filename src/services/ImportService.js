export default class ImportService {
    /**
     * Parses OFX/QFX file content into an array of transaction objects
     * @param {string} content 
     */
    static parseOFX(content) {
        const transactions = [];
        const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
        let match;

        while ((match = trnRegex.exec(content)) !== null) {
            const block = match[1];
            
            const extract = (tag) => {
                const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
                const m = block.match(regex);
                return m ? m[1].trim() : null;
            };

            const dateStr = extract('DTPOSTED');
            const amount = parseFloat(extract('TRNAMT'));
            const memo = extract('MEMO') || extract('NAME') || 'Sem descrição';

            if (dateStr && !isNaN(amount)) {
                const date = new Date(`${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T12:00:00Z`);

                transactions.push({
                    tipo: amount > 0 ? 'Receita' : 'Despesa',
                    valor: Math.abs(amount),
                    descricao: memo,
                    data: date.toISOString(),
                    status: 'Pago'
                });
            }
        }

        return transactions;
    }

    /**
     * Parses CSV content into an array of transaction objects.
     * Supports multiple bank formats (Nubank, Itaú, Bradesco, generic).
     * @param {string} content 
     */
    static parseCSV(content) {
        const lines = content.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return [];

        const header = lines[0];
        const delimiter = header.includes(';') ? ';' : ',';
        const columns = header.split(delimiter).map(c => c.replace(/['"]/g, '').trim().toLowerCase());

        const colMap = {
            date: -1, amount: -1, desc: -1, type: -1, doc: -1
        };

        const patterns = {
            date: [/data/, /data.*mov/, /data.*lan/, /date/, /vencimento/, /competencia/],
            amount: [/valor/, /amount/, /val[or]?/, /r\$/, /preço/, /preco/, /saldo/],
            desc: [/descriç/, /descricao/, /historico/, /histórico/, /description/, /nome/, /memo/, /identificador/],
            type: [/tipo/, /type/, /entrada/, /saida/, /débito/, /credito/, /debito/, /crédito/],
            doc: [/documento/, /doc/, /num/, /número/]
        };

        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            for (const [key, regexes] of Object.entries(patterns)) {
                if (colMap[key] !== -1) continue;
                if (regexes.some(r => r.test(col))) {
                    colMap[key] = i;
                }
            }
        }

        const parseDate = (str) => {
            str = str.replace(/['"]/g, '').trim();
            // DD/MM/YYYY or DD-MM-YYYY
            let m = str.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
            if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00`);
            // YYYY-MM-DD
            m = str.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
            if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
            return null;
        };

        const parseAmount = (str) => {
            if (!str) return NaN;
            str = str.replace(/['"]/g, '').trim();
            str = str.replace(/\./g, '').replace(',', '.');
            str = str.replace(/[^0-9.\-]/g, '');
            return parseFloat(str);
        };

        const transactions = [];

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(delimiter);
            
            let date = null;
            let amount = NaN;
            let desc = '';
            let tipo = '';

            if (colMap.date !== -1 && row[colMap.date]) {
                date = parseDate(row[colMap.date]);
            }

            if (colMap.amount !== -1 && row[colMap.amount]) {
                amount = parseAmount(row[colMap.amount]);
            }

            if (colMap.desc !== -1 && row[colMap.desc]) {
                desc = row[colMap.desc].replace(/['"]/g, '').trim();
            } else if (colMap.doc !== -1 && row[colMap.doc]) {
                desc = row[colMap.doc].replace(/['"]/g, '').trim();
            }
            
            if (colMap.type !== -1 && row[colMap.type]) {
                tipo = row[colMap.type].toLowerCase();
            } else if (!desc && colMap.doc !== -1 && row[colMap.doc]) {
                desc = row[colMap.doc].replace(/['"]/g, '').trim();
            }

            if (!desc) desc = 'Sem descrição';

            if (date && !isNaN(amount)) {
                const isExpense = tipo.includes('saída') || tipo.includes('débito') || tipo.includes('despesa') || 
                                  tipo.includes('debito') || amount < 0;
                transactions.push({
                    tipo: (tipo.includes('receita') || tipo.includes('entrada') || amount < 0 === false && !isExpense) && amount >= 0 ? 'Receita' : 'Despesa',
                    valor: Math.abs(amount),
                    descricao: desc.substring(0, 255),
                    data: date.toISOString(),
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
