export const MISSING_KEY = '___MISSING_KEY___'
export const MISSING_TABLE_SERVICE = '___MISSING_TABLE_SERVICE___'

export type Table<T> = Readonly<Record<string, Readonly<T>>>

export type mutableTable<T> = Record<string, Readonly<T>>;

export type TableService<T> = {
    get(key: string): Promise<T>;
    set(key: string, val: T): Promise<void>;
    delete(key: string): Promise<void>;
}

// Q 2.1 (a)
export function makeTableService<T>(sync: (table?: Table<T>) => Promise<Table<T>>): TableService<T> {
    
    return {
        get(key: string): Promise<T> {
             return sync().then(table => {
                return key in table ? Promise.resolve(table[key]) : Promise.reject(MISSING_KEY);
            });
        },
        set(key: string, val: T): Promise<void> {
            return sync().then(table=>{
                let newTable:mutableTable<T> = table;
                newTable[key] = val;
                sync(newTable);
                return Promise.resolve();
            })
        },
        delete(key: string): Promise<void> {
            return sync().then(table=>{
                let newTable2:mutableTable<T> = table;
                if (key in table) {
                    delete newTable2[key] ;
                    sync(newTable2);
                }
                return key in table ? Promise.resolve() : Promise.reject(MISSING_KEY);
            })
        }
        
    }
}

// Q 2.1 (b)
export function getAll<T>(store: TableService<T>, keys: string[]): Promise<T[]> {
    return Promise.all(keys.map(store.get));
}


// Q 2.2
export type Reference = { table: string, key: string }

export type TableServiceTable = Table<TableService<object>>

export function isReference<T>(obj: T | Reference): obj is Reference {
    return typeof obj === 'object' && 'table' in obj
}

export async function constructObjectFromTables(tables: TableServiceTable, ref: Reference) {
//TO COMPLETE !!!!!!!!!
    async function deref(ref: Reference) {
       if(!tables.hasOwnProperty(ref.table))
            return Promise.reject(MISSING_TABLE_SERVICE);

        let v:TableService<object> = tables[ref.table]
        const obj = await v.get(ref.key);
        try{
            let objs = Object.entries(obj)

            for(let key in objs){
                if(isReference(objs[key][1]))
                    objs[key][1] = await deref(objs[key][1]);
            }
            return Promise.resolve(obj);
        }
        catch{
            Promise.reject(MISSING_KEY)
        }

    }
    return deref(ref);
}

// Q 2.3

export function lazyProduct<T1, T2>(g1: () => Generator<T1>, g2: () => Generator<T2>): () => Generator<[T1, T2]> {
    return function* () {
        for(let x1 of g1()){
            for(let x2 of g2()){
                yield([x1,x2]);
            }
        }
    }
}

export function lazyZip<T1, T2>(g1: () => Generator<T1>, g2: () => Generator<T2>): () => Generator<[T1, T2]> {
    return function* () {
        let gen2 = g2();
        for(let x of g1()){
            yield([x,gen2.next().value]);
        }
    }
}

// Q 2.4
export type ReactiveTableService<T> = {
    get(key: string): T;
    set(key: string, val: T): Promise<void>;
    delete(key: string): Promise<void>;
    subscribe(observer: (table: Table<T>) => void): void
}

export async function makeReactiveTableService<T>(sync: (table?: Table<T>) => Promise<Table<T>>, optimistic: boolean): Promise<ReactiveTableService<T>> {
    // optional initialization code
    var obsList: ((table: Table<T>) => void)[] = new Array;
    let _table: Table<T> = await sync()

    const deleteTable = (key: string) : Table<T> => {
        let {[key]:val, ...newTable} = _table;
        return newTable;    
    }

    const handleMutation = async (newTable: Table<T>) => {
        if (optimistic)
            for (let i=0; i<obsList.length; i++)
                obsList[i](newTable);

        try
        {
            let currTable: Table<T> = await sync(newTable)
            if (!optimistic){
                for (let i=0; i<obsList.length; i++)
                    obsList[i](currTable);
            }
            _table = currTable;
            return Promise.resolve();
        }

        catch (err)
        {
            if (optimistic)
                for (let i=0; i<obsList.length; i++)
                    obsList[i](_table);
            return Promise.reject(err);

        }  
    }

    return {
        get(key: string): T {
            if (key in _table) {
                return _table[key]
            } else {
                throw MISSING_KEY
            }
        },
        set(key: string, val: T): Promise<void> {
            return handleMutation({..._table , [key]:val})
        },
        delete(key: string): Promise<void> {
            return handleMutation((deleteTable(key)))
        },

        subscribe(observer: (table: Table<T>) => void): void {
            obsList.push(observer);
        }
    }
    
}





