// L5-typecheck
// ========================================================
import { equals, filter, flatten, includes, map, intersection, zipWith, reduce, forEach, concat, is } from 'ramda';
import { isAppExp, isBoolExp, isDefineExp, isIfExp, isLetrecExp, isLetExp, isNumExp,
         isPrimOp, isProcExp, isProgram, isStrExp, isVarRef, unparse, parseL51,
         AppExp, BoolExp, DefineExp, Exp, IfExp, LetrecExp, LetExp, NumExp, SetExp, LitExp,
         Parsed, PrimOp, ProcExp, Program, StrExp, isSetExp, isLitExp, 
         isDefineTypeExp, isTypeCaseExp, DefineTypeExp, TypeCaseExp, CaseExp, makeTypeCaseExp } from "./L5-ast";
import { applyExtendTEnv, applyTEnv, makeEmptyTEnv, makeExtendTEnv, TEnv } from "./TEnv";
import { isProcTExp, makeBoolTExp, makeNumTExp, makeProcTExp, makeStrTExp, makeVoidTExp,
         parseTE, unparseTExp, Record,
         BoolTExp, NumTExp, StrTExp, TExp, VoidTExp, UserDefinedTExp, isUserDefinedTExp, UDTExp, 
         isNumTExp, isBoolTExp, isStrTExp, isVoidTExp,
         isRecord, ProcTExp, makeUserDefinedNameTExp, Field, makeAnyTExp, isAnyTExp, isUserDefinedNameTExp,  makeSymbolTExp, makePairTExp, makeUserDefinedTExp, UserDefinedNameTExp } from "./TExp";
import { isEmpty, allT, first, rest, cons } from '../shared/list';
import { isNumber, isString } from '../shared/type-predicates';
import { isEmptySExp, isSymbolSExp  } from './L5-value';
import { Result, makeFailure, bind, makeOk, zipWithResult, mapv, mapResult, isFailure, either, isOk } from '../shared/result';
import {isCompoundSexp } from '../shared/parser';

// L51
export const getTypeDefinitions = (p: Program): UserDefinedTExp[] => {
    const iter = (head: Exp, tail: Exp[]): UserDefinedTExp[] =>
        isEmpty(tail) && isDefineTypeExp(head) ? [head.udType] :
        isEmpty(tail) ? [] :
        isDefineTypeExp(head) ? cons(head.udType, iter(first(tail), rest(tail))) :
        iter(first(tail), rest(tail));
    return isEmpty(p.exps) ? [] :
        iter(first(p.exps), rest(p.exps));
}

// L51
export const getDefinitions = (p: Program): DefineExp[] => {
    const iter = (head: Exp, tail: Exp[]): DefineExp[] =>
        isEmpty(tail) && isDefineExp(head) ? [head] :
        isEmpty(tail) ? [] :
        isDefineExp(head) ? cons(head, iter(first(tail), rest(tail))) :
        iter(first(tail), rest(tail));
    return isEmpty(p.exps) ? [] :
        iter(first(p.exps), rest(p.exps));
}

// L51
export const getRecords = (p: Program): Record[] =>
    flatten(map((ud: UserDefinedTExp) => ud.records, getTypeDefinitions(p)));

// L51
export const getItemByName = <T extends {typeName: string}>(typeName: string, items: T[]): Result<T> =>
    isEmpty(items) ? makeFailure(`${typeName} not found`) :
    first(items).typeName === typeName ? makeOk(first(items)) :
    getItemByName(typeName, rest(items));

// L51
export const getUserDefinedTypeByName = (typeName: string, p: Program): Result<UserDefinedTExp> =>
    getItemByName(typeName, getTypeDefinitions(p));

// L51
export const getRecordByName = (typeName: string, p: Program): Result<Record> =>
    getItemByName(typeName, getRecords(p));

// L51
// Given the name of record, return the list of UD Types that contain this record as a case.
export const getRecordParents = (typeName: string, p: Program): UserDefinedTExp[] =>
    filter((ud: UserDefinedTExp): boolean => map((rec: Record) => rec.typeName, ud.records).includes(typeName),
        getTypeDefinitions(p));


// L51
// Given a user defined type name, return the Record or UD Type which it names.
// (Note: TS fails to type check either in this case)
export const getTypeByName = (typeName: string, p: Program): Result<UDTExp> => {
    const ud = getUserDefinedTypeByName(typeName, p);
    if (isFailure(ud)) {
        return getRecordByName(typeName, p);
    } else {
        return ud;
    }
}

// TODO L51
// Is te1 a subtype of te2?
// const isSubType = (te1: TExp, te2: TExp, p: Program): boolean => {
//     if(isUserDefinedNameTExp(te1) && isUserDefinedNameTExp(te2) && isOk(getRecordByName(te1.typeName,p))){
//         let user = getUserDefinedTypeByName(te2.typeName, p)
//         if(isOk(user)){
//             return getRecordParents(te1.typeName,p).includes(user.value)
//         }  
//     } 
//     return isAnyTExp(te2) ? true : false
// }

const isSubType = (te1: TExp, te2: TExp, p: Program): boolean => {
   if(isAnyTExp(te2)) return true;


    let parentList;
    if(isUserDefinedTExp(te1) && isUserDefinedTExp(te2)){
        parentList = filter((par)=> isUserDefinedTExp(par) && par.typeName===te2.typeName,getParentsType(te1,p))
        if(parentList.length!=0)
            return true
    }

    if(isUserDefinedNameTExp(te1) && isUserDefinedNameTExp(te2)){
        if(isOk(getRecordByName(te1.typeName,p))){
            let UD = getUserDefinedTypeByName(te2.typeName, p)
            if(isOk(UD)){
                return getRecordParents(te1.typeName,p).includes(UD.value)
            }
        }
    }

    return false
}


//     //if te1 is name - extract the acual type
//     let te1AcType : UserDefinedTExp | Record;
//     if(isUserDefinedNameTExp(te1))
//     {
//         console.log("te1 is user define name texp: " + te1.typeName)
//         let curr = getTypeByName(te1.typeName, p);
//         if(isOk(curr)){
//             console.log("first argument type name is: " + te1.typeName)
//             te1AcType = curr.value;
//         }

//         else{
//             return false;
//         }

//     }
//     else if(isRecord(te1) || isUserDefinedTExp(te1)) {
//             te1AcType = te1;
//             console.log("te1 is record or user defined " + te1.typeName)
//     }
//     else return false;

//     //if te2 is name - extract the acual type
//     let te2AcType : UserDefinedTExp | Record;
//     if(isUserDefinedNameTExp(te2))
//     {
//         let curr = getTypeByName(te2.typeName, p);
//         if(isOk(curr)){
//             te2AcType = curr.value;
//             console.log("second argument type name is: " + te2.typeName)
//         }
//         else{
//              return false;
//         }
           
//     }
//     else if(isRecord(te2) || isUserDefinedTExp(te2)) 
//             te2AcType = te2;
//     else return false;


//     if((isUserDefinedTExp(te2AcType) && isUserDefinedTExp(te1AcType)) || (isRecord(te2AcType) && isRecord(te1AcType)))
//           return te2AcType.typeName === te1AcType.typeName;
    

//     if(isUserDefinedTExp(te2AcType) && isRecord(te1AcType)){
//         console.log("first is rec, second is define " + te2AcType.typeName + "----" +te1AcType.typeName )
//         const parentsList = getRecordParents(te1AcType.typeName,p);
//         parentsList.forEach(p => {
//             if(p.typeName === te2AcType.typeName) return true
//         })

//     }
//     return false;
// }


// TODO L51: Change this definition to account for user defined types
// Purpose: Check that the computed type te1 can be accepted as an instance of te2
// test that te1 is either the same as te2 or more specific
// Deal with case of user defined type names 
// Exp is only passed for documentation purposes.
// p is passed to provide the context of all user defined types
export const checkEqualType = (te1: TExp, te2: TExp, exp: Exp, p: Program): Result<TExp> =>
  equals(te1, te2) || isSubType(te1, te2, p) ? makeOk(te2) :
  bind(unparseTExp(te1), (te1: string) =>
    bind(unparseTExp(te2), (te2: string) =>
        bind(unparse(exp), (exp: string) =>
  makeFailure(`Incompatible types: ${te1} and ${te2} in ${exp}`))));


// L51
// Return te and its parents in type hierarchy to compute type cover
// Return type names (not their definition)
export const getParentsType = (te: TExp, p: Program): TExp[] =>
    (isNumTExp(te) || isBoolTExp(te) || isStrTExp(te) || isVoidTExp(te) || isAnyTExp(te)) ? [te] :
    isProcTExp(te) ? [te] :
    isUserDefinedTExp(te) ? [te] :
    isRecord(te) ? getParentsType(makeUserDefinedNameTExp(te.typeName), p) :
    isUserDefinedNameTExp(te) ?
        either(getUserDefinedTypeByName(te.typeName, p),
                (ud: UserDefinedTExp) => [makeUserDefinedNameTExp(ud.typeName)],
                (_) => either(getRecordByName(te.typeName, p),
                            (rec: Record) => cons(makeUserDefinedNameTExp(rec.typeName), 
                                                  map((ud) => makeUserDefinedNameTExp(ud.typeName), 
                                                      getRecordParents(rec.typeName, p))),
                            (_) => [])) : 
    [];

// L51
// Get the list of types that cover all ts in types.
export const coverTypes = (types: TExp[], p: Program): TExp[] =>  {
    // [[p11, p12], [p21], [p31, p32]] --> types in intersection of all lists
    const parentsList : TExp[][] = map((t) => getParentsType(t,p), types);
    return reduce<TExp[], TExp[]>(intersection, first(parentsList), rest(parentsList));
}
// Return the most specific in a list of TExps
// For example given UD(R1, R2):
// - mostSpecificType([R1, R2, UD]) = R1 (choses first out of record level)
// - mostSpecificType([R1, number]) = number  
export const mostSpecificType = (types: TExp[], p: Program): TExp =>
    reduce((min: TExp, element: TExp) => isSubType(element, min, p) ? element : min, 
            makeAnyTExp(),
            types);

// L51
// Check that all t in types can be covered by a single parent type (not by 'any')
// Return most specific parent
export const checkCoverType = (types: TExp[], p: Program): Result<TExp> => {
    const cover = coverTypes(types, p);
    return isEmpty(cover) ? makeFailure(`No type found to cover ${map((t) => JSON.stringify(unparseTExp(t), null, 2), types).join(" ")}`) :
    makeOk(mostSpecificType(cover, p));
}


// Compute the initial TEnv given user defined types
// =================================================
// TODO L51
// Construct type environment for the user-defined type induced functions
// Type constructor for all records
// Type predicate for all records
// Type predicate for all user-defined-types
// All globally defined variables (with define)

// TODO: Define here auxiliary functions for TEnv computation
const addRecords = (p: Program, env : TEnv): TEnv =>{
    let allRecords = getRecords(p);
    let RecordsNames = allRecords.map(d => d.typeName);
    env = makeExtendTEnv(RecordsNames, allRecords, env);

    let predicats = RecordsNames.map(n => n.concat('?'));
    let predicatsType = predicats.map(_=> makeProcTExp([makeAnyTExp()], makeBoolTExp()));
    env =  makeExtendTEnv(predicats, predicatsType, env);

    let constructures = RecordsNames.map(n => 'make-'.concat(n));
    let constructType = allRecords.map(curr=> makeProcTExp(curr.fields.map(f=>f.te), curr));
    return makeExtendTEnv(constructures, constructType, env);
}

const addTypeDefines = (p: Program, env : TEnv): TEnv =>{
    let allTypeDefines = getTypeDefinitions(p);
    let typeDefineNames = allTypeDefines.map(d => d.typeName);
    env = makeExtendTEnv(typeDefineNames, allTypeDefines, env);

    let predicats = typeDefineNames.map(n => n.concat('?'));
    let predicatsType = predicats.map(_=> makeProcTExp([makeAnyTExp()], makeBoolTExp()))

    return makeExtendTEnv(predicats, predicatsType, env);
}

const addDefines = (p: Program, env : TEnv): TEnv =>{
    let allDefines = getDefinitions(p);
    let defineNames = allDefines.map(d => d.var.var)
    let defineTypes = allDefines.map(d => d.var.texp)
    return makeExtendTEnv(defineNames, defineTypes, env);
}


// TOODO L51
// Initialize TEnv with:
// * Type of global variables (define expressions at top level of p)
// * Type of implicitly defined procedures for user defined types (define-type expressions in p)
export const initTEnv = (p: Program): TEnv =>{
    let env : TEnv = makeEmptyTEnv();
    env = addDefines(p, env);
    env = addTypeDefines(p, env);
    return addRecords(p, env);
}


// Verify that user defined types and type-case expressions are semantically correct
// =================================================================================
// TODO L51
const checkUserDefinedTypes = (p: Program): Result<true> =>
    // If the same type name is defined twice with different definitions
    // If a recursive type has no base case
{
    let records:Record[] = getRecords(p)

    records.forEach(rec => {
        let parents = getRecordParents(rec.typeName,p)
        if(parents.length>1){
            parents.forEach(parent =>{
                let curRecField = parent.records[parent.records.indexOf(rec)].fields
                if(curRecField.length===rec.fields.length){
                    //checks fields match
                    for(let i = 0; i<rec.fields.length ; i++){
                        if(!(rec.fields[i].fieldName === curRecField[i].fieldName
                            && rec.fields[i].te === curRecField[i].te))
                            return makeFailure("fields do not match")
                    }
                }
                else return makeFailure("there is no match between fields")
            })
        }
    })

    let usersDefines:UserDefinedTExp[] = getTypeDefinitions(p);
    usersDefines.forEach(user =>{
        let curRecords:Record[] = user.records
        let foundGoodRec:boolean = false;
        curRecords.forEach(curRec =>{
            let curFields = curRec.fields
            let allFieldClean:boolean = true
            curFields.forEach(field => {
                if(isUserDefinedTExp(field.te) && field.te.typeName === user.typeName)
                    allFieldClean = false
               // if(isUserDefinedTExp(field.te) && field.fieldName !== user.typeName)
               //     return makeFailure("in the record: "+curRec+" there is User-define fiels which is not his father")
            })
            if(allFieldClean)
                foundGoodRec = true
        })
        if(foundGoodRec) return makeOk(true)
    })

    return makeOk(true);
}


// TODO L51
// const checkTypeCase = (tc: TypeCaseExp, p: Program): Result<true> => 
// {
//    // let userDefined = getUserDefinedTypeByName(tc.typeName, p)

//     let expArguments:UDTExp[] = new Array();
//     for(let i=0 ; tc.cases.length>i ; i++){
//         let c:CaseExp = tc.cases[i]
//         let caseType = getTypeByName(c.typeName,p)
//         if(isOk(caseType))
//             expArguments.push(caseType.value)
//         console.log("Here is the arguments: "+expArguments[i].typeName)
//     }

//     //console.log("Here is the arguments: "+expArguments[0].typeName)

//     let firstArg = getTypeByName(tc.typeName, p)

//     isOk(firstArg)? 
//         expArguments.push(firstArg.value)
//      : makeFailure("problem with first argument")
//     console.log("Here is the first arg: "+tc.typeName)

//     let userDefined;
    
//     let userDefined1;
//     let parent = checkCoverType(expArguments,p)

//     //console.log("the parent is: "+ parent.tag)
//     if (parent === undefined)
//         makeFailure("parent is undefinned")

//     if(isOk(parent)) {
//         if(isUserDefinedNameTExp(parent.value))
//             {
//             let res = getUserDefinedTypeByName(parent.value.typeName,p)
//             if(isOk(res))
//                 userDefined = res.value
//             }
//         else
//             userDefined = userDefined1
//     }
//     else
//         makeFailure("to be honest parent is not ok")

//     if(userDefined!=undefined &&isUserDefinedTExp(userDefined)){
//         console.log("parent is: "+userDefined.typeName)

//         let records : Record[] = userDefined.records
//         let cases : CaseExp[] = tc.cases

//         if(records.length != cases.length)
//             return makeFailure("the lists: records and cases, don't have the same length")

//         records.forEach(rec => {
           
//             let found:boolean = false;
//             let i:number = 0;
//             while(!found && i < cases.length - 1){
//                  console.log("now im in for each loop with record: "+ rec.typeName)
//                 if(rec.typeName === cases[i].typeName && rec.fields.length === cases[i].varDecls.length){
//                     found = true
//                     console.log("if condition sucseed")
//                 }
//                 i++;
//             }
//             if(!found) return makeFailure("there is no match between cases & records of this type")
//         })

//         return makeOk(true)      
//     }
//     else 
//         return makeFailure("this is not user define type")
// }

const checkTypeCase = (tc: TypeCaseExp, p: Program): Result<true> => {
    let expArguments:UDTExp[] = new Array();

    for(let i=0 ; i<tc.cases.length ; i++){
        let c:CaseExp = tc.cases[i]
        let caseType = getTypeByName(c.typeName,p)
        if(isOk(caseType))
            expArguments.push(caseType.value)
    }

    let parent = getUserDefinedTypeByName(tc.typeName, p)
    parent = isOk(parent) ? parent :
        checkCoverType(expArguments,p) ? makeOk(getRecordParents(tc.typeName,p)[0]) :
        makeFailure("Fail this firstArg")
    
let res:boolean = false;
if(isOk(parent)){
    let userType = parent;
    let records: Record[] = userType.value.records
    let reduceBoolean =  reduce((acc,elem)=> {
        return acc && records.map((record)=> record.typeName).includes(elem.typeName) &&
        elem.varDecls.length === records.filter((record)=>record.typeName === elem.typeName)[0].fields.length
    } , true, tc.cases)

    res = tc.cases.length === records.length && reduceBoolean
    console.log(res)
}
return res ? makeOk(res) : makeFailure("Fail")

}


// Compute the type of L5 AST exps to TE
// ===============================================
// Compute a Typed-L5 AST exp to a Texp on the basis
// of its structure and the annotations it contains.

// Purpose: Compute the type of a concrete fully-typed expression
export const L51typeofProgram = (concreteExp: string): Result<string> =>
    bind(parseL51(concreteExp), (p: Program) =>
        bind(typeofExp(p, initTEnv(p), p), unparseTExp));

// For tests on a single expression - wrap the expression in a program
export const L51typeof = (concreteExp: string): Result<string> =>
    L51typeofProgram(`(L51 ${concreteExp})`);

// Purpose: Compute the type of an expression
// Traverse the AST and check the type according to the exp type.
// We assume that all variables and procedures have been explicitly typed in the program.
export const typeofExp = (exp: Parsed, tenv: TEnv, p: Program): Result<TExp> =>
    isNumExp(exp) ? makeOk(typeofNum(exp)) :
    isBoolExp(exp) ? makeOk(typeofBool(exp)) :
    isStrExp(exp) ? makeOk(typeofStr(exp)) :
    isPrimOp(exp) ? typeofPrim(exp) :
    isVarRef(exp) ? applyTEnv(tenv, exp.var) :
    isIfExp(exp) ? typeofIf(exp, tenv, p) :
    isProcExp(exp) ? typeofProc(exp, tenv, p) :
    isAppExp(exp) ? typeofApp(exp, tenv, p) :
    isLetExp(exp) ? typeofLet(exp, tenv, p) :
    isLetrecExp(exp) ? typeofLetrec(exp, tenv, p) :
    isDefineExp(exp) ? typeofDefine(exp, tenv, p) :
    isProgram(exp) ? typeofProgram(exp, tenv, p) :
    isSetExp(exp) ? typeofSet(exp, tenv, p) :
    isLitExp(exp) ? typeofLit(exp, tenv, p) :
    isDefineTypeExp(exp) ? typeofDefineType(exp, tenv, p) :
    isTypeCaseExp(exp) ? typeofTypeCase(exp, tenv, p) :
    makeFailure(`Unknown type: ${JSON.stringify(exp, null, 2)}`);

// Purpose: Compute the type of a sequence of expressions
// Check all the exps in a sequence - return type of last.
// Pre-conditions: exps is not empty.
export const typeofExps = (exps: Exp[], tenv: TEnv, p: Program): Result<TExp> =>
    isEmpty(rest(exps)) ? typeofExp(first(exps), tenv, p) :
    bind(typeofExp(first(exps), tenv, p), _ => typeofExps(rest(exps), tenv, p));

// a number literal has type num-te
export const typeofNum = (n: NumExp): NumTExp => makeNumTExp();

// a boolean literal has type bool-te
export const typeofBool = (b: BoolExp): BoolTExp => makeBoolTExp();

// a string literal has type str-te
const typeofStr = (s: StrExp): StrTExp => makeStrTExp();

// primitive ops have known proc-te types
const numOpTExp = parseTE('(number * number -> number)');
const numCompTExp = parseTE('(number * number -> boolean)');
const boolOpTExp = parseTE('(boolean * boolean -> boolean)');

// L51 Todo: cons, car, cdr, list
export const typeofPrim = (p: PrimOp): Result<TExp> =>
    (p.op === '+') ? numOpTExp :
    (p.op === '-') ? numOpTExp :
    (p.op === '*') ? numOpTExp :
    (p.op === '/') ? numOpTExp :
    (p.op === 'and') ? boolOpTExp :
    (p.op === 'or') ? boolOpTExp :
    (p.op === '>') ? numCompTExp :
    (p.op === '<') ? numCompTExp :
    (p.op === '=') ? numCompTExp :
    // Important to use a different signature for each op with a TVar to avoid capture
    (p.op === 'number?') ? parseTE('(T -> boolean)') :
    (p.op === 'boolean?') ? parseTE('(T -> boolean)') :
    (p.op === 'string?') ? parseTE('(T -> boolean)') :
    (p.op === 'list?') ? parseTE('(T -> boolean)') :
    (p.op === 'pair?') ? parseTE('(T -> boolean)') :
    (p.op === 'symbol?') ? parseTE('(T -> boolean)') :
    (p.op === 'not') ? parseTE('(boolean -> boolean)') :
    (p.op === 'eq?') ? parseTE('(T1 * T2 -> boolean)') :
    (p.op === 'string=?') ? parseTE('(T1 * T2 -> boolean)') :
    (p.op === 'display') ? parseTE('(T -> void)') :
    (p.op === 'newline') ? parseTE('(Empty -> void)') :
    makeFailure(`Primitive not yet implemented: ${p.op}`);

// TODO L51
// Change this definition to account for possibility of subtype expressions between thenTE and altTE
// 
// Purpose: compute the type of an if-exp
// Typing rule:
//   if type<test>(tenv) = boolean
//      type<then>(tenv) = t1
//      type<else>(tenv) = t1
// then type<(if test then else)>(tenv) = t1
export const typeofIf = (ifExp: IfExp, tenv: TEnv, p: Program): Result<TExp> => {
    const testTE = typeofExp(ifExp.test, tenv, p);
    const thenTE = typeofExp(ifExp.then, tenv, p);
    const altTE = typeofExp(ifExp.alt, tenv, p);
    const constraint1 = bind(testTE, testTE => checkEqualType(testTE, makeBoolTExp(), ifExp, p));
    const constraint2 = bind(thenTE, (thenTE: TExp) =>
                            bind(altTE, (altTE: TExp) =>
                                checkEqualType(thenTE, altTE, ifExp, p)));
    if(isOk(constraint2))
        return bind(constraint1, (_c1) => constraint2);
    
    const constraint3 = bind(thenTE, (thenTE: TExp) =>
                            bind(altTE, (altTE: TExp) =>
                                checkCoverType([thenTE, altTE], p)));
    return bind(constraint1, (_c1) => constraint3);

};

// Purpose: compute the type of a proc-exp
// Typing rule:
// If   type<body>(extend-tenv(x1=t1,...,xn=tn; tenv)) = t
// then type<lambda (x1:t1,...,xn:tn) : t exp)>(tenv) = (t1 * ... * tn -> t)
export const typeofProc = (proc: ProcExp, tenv: TEnv, p: Program): Result<TExp> => {
    const argsTEs = map((vd) => vd.texp, proc.args);
    const extTEnv = makeExtendTEnv(map((vd) => vd.var, proc.args), argsTEs, tenv);
    const constraint1 = bind(typeofExps(proc.body, extTEnv, p), (body: TExp) => 
                            checkEqualType(body, proc.returnTE, proc, p));
    return bind(constraint1, (returnTE: TExp) => makeOk(makeProcTExp(argsTEs, returnTE)));
};

// Purpose: compute the type of an app-exp
// Typing rule:
// If   type<rator>(tenv) = (t1*..*tn -> t)
//      type<rand1>(tenv) = t1
//      ...
//      type<randn>(tenv) = tn
// then type<(rator rand1...randn)>(tenv) = t
// We also check the correct number of arguments is passed.
export const typeofApp = (app: AppExp, tenv: TEnv, p: Program): Result<TExp> =>
    bind(typeofExp(app.rator, tenv, p), (ratorTE: TExp) => {
        if (! isProcTExp(ratorTE)) {
            return bind(unparseTExp(ratorTE), (rator: string) =>
                        bind(unparse(app), (exp: string) =>
                            makeFailure<TExp>(`Application of non-procedure: ${rator} in ${exp}`)));
        }
        if (app.rands.length !== ratorTE.paramTEs.length) {
            return bind(unparse(app), (exp: string) => makeFailure<TExp>(`Wrong parameter numbers passed to proc: ${exp}`));
        }
        const constraints = zipWithResult((rand, trand) => bind(typeofExp(rand, tenv, p), (typeOfRand: TExp) => 
                                                                checkEqualType(typeOfRand, trand, app, p)),
                                          app.rands, ratorTE.paramTEs);
        return mapv(constraints, _ => ratorTE.returnTE);
    });

// Purpose: compute the type of a let-exp
// Typing rule:
// If   type<val1>(tenv) = t1
//      ...
//      type<valn>(tenv) = tn
//      type<body>(extend-tenv(var1=t1,..,varn=tn; tenv)) = t
// then type<let ((var1 val1) .. (varn valn)) body>(tenv) = t
export const typeofLet = (exp: LetExp, tenv: TEnv, p: Program): Result<TExp> => {
    const vars = map((b) => b.var.var, exp.bindings);
    const vals = map((b) => b.val, exp.bindings);
    const varTEs = map((b) => b.var.texp, exp.bindings);
    const constraints = zipWithResult((varTE, val) => bind(typeofExp(val, tenv, p), (typeOfVal: TExp) => 
                                                            checkEqualType(varTE, typeOfVal, exp, p)),
                                      varTEs, vals);
    return bind(constraints, _ => typeofExps(exp.body, makeExtendTEnv(vars, varTEs, tenv), p));
};

// Purpose: compute the type of a letrec-exp
// We make the same assumption as in L4 that letrec only binds proc values.
// Typing rule:
//   (letrec((p1 (lambda (x11 ... x1n1) body1)) ...) body)
//   tenv-body = extend-tenv(p1=(t11*..*t1n1->t1)....; tenv)
//   tenvi = extend-tenv(xi1=ti1,..,xini=tini; tenv-body)
// If   type<body1>(tenv1) = t1
//      ...
//      type<bodyn>(tenvn) = tn
//      type<body>(tenv-body) = t
// then type<(letrec((p1 (lambda (x11 ... x1n1) body1)) ...) body)>(tenv-body) = t
export const typeofLetrec = (exp: LetrecExp, tenv: TEnv, p: Program): Result<TExp> => {
    const ps = map((b) => b.var.var, exp.bindings);
    const procs = map((b) => b.val, exp.bindings);
    if (! allT(isProcExp, procs))
        return makeFailure(`letrec - only support binding of procedures - ${JSON.stringify(exp, null, 2)}`);
    const paramss = map((p) => p.args, procs);
    const bodies = map((p) => p.body, procs);
    const tijs = map((params) => map((p) => p.texp, params), paramss);
    const tis = map((proc) => proc.returnTE, procs);
    const tenvBody = makeExtendTEnv(ps, zipWith((tij, ti) => makeProcTExp(tij, ti), tijs, tis), tenv);
    const tenvIs = zipWith((params, tij) => makeExtendTEnv(map((p) => p.var, params), tij, tenvBody),
                           paramss, tijs);
    const types = zipWithResult((bodyI, tenvI) => typeofExps(bodyI, tenvI, p), bodies, tenvIs)
    const constraints = bind(types, (types: TExp[]) => 
                            zipWithResult((typeI, ti) => checkEqualType(typeI, ti, exp, p), types, tis));
    return bind(constraints, _ => typeofExps(exp.body, tenvBody, p));
};

// TODO - write the true definition
// Purpose: compute the type of a define
// Typing rule:
//   (define (var : texp) val)
//   tenv-val = extend-tenv(var:texp; tenv)
// If   type<val>(tenv-val) = texp
// then type<(define (var : texp) val)>(tenv) = void
export const typeofDefine = (exp: DefineExp, tenv: TEnv, p: Program): Result<VoidTExp> => {
    const v = exp.var.var;
    const texp = exp.var.texp;
    const val = exp.val;
    const tenvVal = makeExtendTEnv([v], [texp], tenv);
    const constraint = typeofExp(val, tenvVal, p);    
    return mapv(constraint, (_) => makeVoidTExp());
};

// Purpose: compute the type of a program
// Typing rule:
export const typeofProgram = (exp: Program, tenv: TEnv, p: Program): Result<TExp> =>
    typeofExps(exp.exps, tenv, p);

// TODO L51
// Write the typing rule for DefineType expressions
export const typeofDefineType = (exp: DefineTypeExp, _tenv: TEnv, _p: Program): Result<TExp> =>{
    if(isOk(getUserDefinedTypeByName(exp.typeName,_p)))  
            if(isOk(checkUserDefinedTypes(_p))){
                    return makeOk(makeVoidTExp()) 
                   // makeExtendTEnv(exp.udType.
            } 
    return makeFailure("typeOfdEFINEtYPE FUNCTION FAILED")
}

// TODO L51
export const typeofSet = (exp: SetExp, _tenv: TEnv, _p: Program): Result<TExp> =>
    bind(typeofExp(exp.val, _tenv, _p), (valT: TExp) => 
        bind(typeofExp(exp.var, _tenv, _p), (varT: TExp) => 
        bind(checkEqualType(varT, valT, exp, _p), (result: TExp) => makeOk(makeVoidTExp()))));
 

// TODO L51
export const typeofLit = (exp: LitExp, _tenv: TEnv, _p: Program): Result<TExp> =>
    isString(exp.val) ? makeOk(makeStrTExp()) :
    isNumber(exp.val) ? makeOk(makeNumTExp()) : 
    exp.val === true ? makeOk(makeBoolTExp()) :
    exp.val === false ? makeOk(makeBoolTExp()) :
    isEmptySExp(exp.val) ? makeOk(makeSymbolTExp()) :
    isSymbolSExp(exp.val) ? makeOk(makeSymbolTExp(exp.val)) :
    isCompoundSexp(exp.val) ? makeOk(makePairTExp()) :
    makeFailure(`Unknown literal type ${exp}`);

// Purpose: compute the type of a type-case
// Typing rule:
// For all user-defined-type id
//         with component records record_1 ... record_n
//         with fields (field_ij) (i in [1...n], j in [1..R_i])
//         val CExp
//         body_i for i in [1..n] sequences of CExp
//   ( type-case id val (record_1 (field_11 ... field_1r1) body_1)...  )
//  TODO

export const typeofTypeCase = (exp: TypeCaseExp, tenv: TEnv, p: Program): Result<TExp> => {
    let typeOfBody:TExp[] =[]
    exp.cases.forEach(cas=>{
        let vars = cas.varDecls.map((v)=> v.var)
        let currRecord = getRecordByName(cas.typeName, p)
        if(isOk(currRecord)){
            let varsTE = currRecord.value.fields.map((f)=> f.te)
            let typeOfCurrBody = typeofExps(cas.body, makeExtendTEnv(vars, varsTE, tenv), p)
            if(isOk(typeOfCurrBody))
                typeOfBody.push(typeOfCurrBody.value)
            else
                return makeFailure("failed on typeofExps")
        }
        else
            return makeFailure("currRec is NOT Ok")
    })
    if(!checkTypeCase(exp,p))
        return makeFailure("failed on checkTypeCase")
    return checkCoverType(typeOfBody,p)

}

// export const typeofTypeCase = (exp: TypeCaseExp, tenv: TEnv, p: Program): Result<TExp> => {
//     let rtexps : Result<TExp>[] =  exp.cases.map((c)=>typeOfCase(c,tenv,p))
//     let texp : TExp[] = []
//     for(let i=0; i<rtexps.length; i++){
//         let r = rtexps[i]
//         if(isOk(r))
//         texp.push(r.value)
//     }
//     return bind(checkTypeCase(exp,p) , (_)=> 
//         texp.length === rtexps.length ? checkCoverType(texp,p)  : makeFailure("failed")    
//     )
// }

export const typeOfCase =  ( exp: CaseExp, tenv: TEnv, p: Program): Result<TExp> =>{
    const vars = map((b)=> b.var , exp.varDecls)
    let varTEs : TExp[] = []
    let record = getRecordByName(exp.typeName, p)
    if(isOk(record)){
        varTEs = map((f) => f.te, record.value.fields)
        let result = typeofExps(exp.body, makeExtendTEnv(vars, varTEs, tenv) , p)
        if(isOk(result)){
            return result
        }
        return result
    }
    return makeFailure("Failed")
}

