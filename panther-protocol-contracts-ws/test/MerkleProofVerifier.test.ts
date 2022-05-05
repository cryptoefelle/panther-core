// SPDX-License-Identifier: MIT
import { expect } from 'chai';

// @ts-ignore
import {
    toBytes32, PathElementsType, toBigNum, Triad
} from '../lib/utilities';
import { takeSnapshot, revertSnapshot } from './helpers/hardhat';
import { MockTriadIncrementalMerkleTrees } from '../types';
import { deployMockTrees } from './helpers/mockTriadTrees';
import { poseidon } from 'circomlibjs';
import {TriadMerkleTree} from '../lib/tree';
import assert from 'assert';

describe('MerkleProofVerifier', () => {
    let trees: MockTriadIncrementalMerkleTrees;
    let snapshot: number;

    before(async () => {
        trees = await deployMockTrees();
    });

    describe('internal `testVerifyMerkleProof` method - by using circom zkp-input test values', function () {

        describe('a call inserting 3 zero leaves & checking proof for each leaf', function () {

            before(async () => {
                snapshot = await takeSnapshot();
            });

            after(async () => {
                await revertSnapshot(snapshot);
            });

            const amountsOut = [BigInt('7'), BigInt('8'), BigInt('9')];
            const token: BigInt = BigInt('111');
            const createTime: BigInt = BigInt('1651062006');
            const pubKey: BigInt[] = [
                BigInt('18387562449515087847139054493296768033506512818644357279697022045358977016147'),
                BigInt('2792662591747231738854329419102915533513463924144922287150280827153219249810')
            ];
            const commitment0 = poseidon([pubKey[0], pubKey[1], amountsOut[0], token, createTime]);
            const commitment1 = poseidon([pubKey[0], pubKey[1], amountsOut[1], token, createTime]);
            const commitment2 = poseidon([pubKey[0], pubKey[1], amountsOut[2], token, createTime]);

            const merkleRoot = toBytes32('10650828051129756317708141452089125851926509526003232203604419064374393231061');

            const pathElements0 =
                [
                    toBytes32('70575835294174784547258244826603579894295126084098374754150034768326978226'),
                    toBytes32('21165498949491829088726564027049018044359747064678034716482327251128763739323'),
                    toBytes32('5317387130258456662214331362918410991734007599705406860481038345552731150762'),
                    toBytes32('5301900180746108365834837840355741695167403565517259206503735319173783315742'),
                    toBytes32('19759440382600727929415049642887307143518671081639244670052489500787514850212'),
                    toBytes32('11575399251628151734428362828441614938772848828475906566857213866326592241179'),
                    toBytes32('6632555919090241659299800894218068745568431736196896666697681740099319754273'),
                    toBytes32('2313232035512824863888346564211238648697583940443483502600731472911335817854'),
                    toBytes32('12219166190744012474665556054784140979314676975916090596913570678231824844496'),
                    toBytes32('16146864604902996392229526390577377437180881860230124064882884440248322100339'),
                    toBytes32('6883543445806624803603297055410892317599264946303553983246148642156945721809'),
                    toBytes32('11376031557295681140127084012245938798408060888509383225192187436273860950878'),
                    toBytes32('13241605803954237324747758640385138335781780544452364878098724458062976117242'),
                    toBytes32('17855149516804167337625231993818327714748909580849949294952537831754058414670'),
                    toBytes32('5150255556564484319136269061916843962561348275990403501481125286754601797805'),
                    toBytes32('6987786980040962217323608240860512602136308242543772977912408457104385595406'),
                ] as PathElementsType;

            const pathElements1 =
                [
                    toBytes32('5001742625244953632730801981278686902609014698786426456727933168831153597234'),
                    toBytes32('21165498949491829088726564027049018044359747064678034716482327251128763739323'),
                    toBytes32('5317387130258456662214331362918410991734007599705406860481038345552731150762'),
                    toBytes32('5301900180746108365834837840355741695167403565517259206503735319173783315742'),
                    toBytes32('19759440382600727929415049642887307143518671081639244670052489500787514850212'),
                    toBytes32('11575399251628151734428362828441614938772848828475906566857213866326592241179'),
                    toBytes32('6632555919090241659299800894218068745568431736196896666697681740099319754273'),
                    toBytes32('2313232035512824863888346564211238648697583940443483502600731472911335817854'),
                    toBytes32('12219166190744012474665556054784140979314676975916090596913570678231824844496'),
                    toBytes32('16146864604902996392229526390577377437180881860230124064882884440248322100339'),
                    toBytes32('6883543445806624803603297055410892317599264946303553983246148642156945721809'),
                    toBytes32('11376031557295681140127084012245938798408060888509383225192187436273860950878'),
                    toBytes32('13241605803954237324747758640385138335781780544452364878098724458062976117242'),
                    toBytes32('17855149516804167337625231993818327714748909580849949294952537831754058414670'),
                    toBytes32('5150255556564484319136269061916843962561348275990403501481125286754601797805'),
                    toBytes32('6987786980040962217323608240860512602136308242543772977912408457104385595406'),
                ] as PathElementsType;

            const pathElements2 =
                [
                    toBytes32('5001742625244953632730801981278686902609014698786426456727933168831153597234'),
                    toBytes32('70575835294174784547258244826603579894295126084098374754150034768326978226'),
                    toBytes32('5317387130258456662214331362918410991734007599705406860481038345552731150762'),
                    toBytes32('5301900180746108365834837840355741695167403565517259206503735319173783315742'),
                    toBytes32('19759440382600727929415049642887307143518671081639244670052489500787514850212'),
                    toBytes32('11575399251628151734428362828441614938772848828475906566857213866326592241179'),
                    toBytes32('6632555919090241659299800894218068745568431736196896666697681740099319754273'),
                    toBytes32('2313232035512824863888346564211238648697583940443483502600731472911335817854'),
                    toBytes32('12219166190744012474665556054784140979314676975916090596913570678231824844496'),
                    toBytes32('16146864604902996392229526390577377437180881860230124064882884440248322100339'),
                    toBytes32('6883543445806624803603297055410892317599264946303553983246148642156945721809'),
                    toBytes32('11376031557295681140127084012245938798408060888509383225192187436273860950878'),
                    toBytes32('13241605803954237324747758640385138335781780544452364878098724458062976117242'),
                    toBytes32('17855149516804167337625231993818327714748909580849949294952537831754058414670'),
                    toBytes32('5150255556564484319136269061916843962561348275990403501481125286754601797805'),
                    toBytes32('6987786980040962217323608240860512602136308242543772977912408457104385595406'),
                ] as PathElementsType;

            const leafId_0 = BigInt('0');
            const commitment_0 = toBytes32(commitment0);
            it('should be proved - leaf index 0', async () => {
                await trees.testMerkleProof(
                    leafId_0,
                    merkleRoot,
                    commitment_0,
                    pathElements0
                );
                let check = await trees.isProofVerified();
                expect(check == true, "NOT PROVED");
            });

            const leafId_1 = BigInt('1');
            const commitment_1 = toBytes32(commitment1);
            it('should be proved - leaf index 1', async () => {
                await trees.testMerkleProof(
                    leafId_1,
                    merkleRoot,
                    commitment_1,
                    pathElements1
                );
                let check = await trees.isProofVerified();
                expect(check == true, "NOT PROVED");
            });
            const leafId_2 = BigInt('2');
            const commitment_2 = toBytes32(commitment2);
            it('should be proved - leaf index 2', async () => {
                await trees.testMerkleProof(
                    leafId_2,
                    merkleRoot,
                    commitment_2,
                    pathElements2
                );
                let check = await trees.isProofVerified();
                expect(check == true, "NOT PROVED");
            });
            /*
            it('should emit the `PathElements` event', async () => {
                await trees.internalInsertBatchZkp(commitmentsLeavesTriadNumber);
                const elements = await trees.PathElementsV();
                console.log("Solidity NodeHash(3):", elements[0], " vs TypeScript NodeHash(3):", "0x" + BigInt(NodeHash).toString(16));
                const indexes = await trees.PathIndexesV();
                console.log("Elements:", elements);
                console.log("Indexes:", indexes);
                for(let i = 0; i < 15; ++i) {
                    console.log("PathElement[", i , "]:", toBigNum(elements[i]), toBigNum(elements[i]));
                }
                console.log("MT-Root", toBigNum(elements[15]));
                let indexesBigInts : BigInt[] = [];
                for(let i = 1; i < 16; ++i) {
                    indexesBigInts.push(BigInt(indexes[i] ? 1:0 ));
                }
                console.log("Path-Indexes:", indexesBigInts);
                expect(true);
                let CurrentRoot = await trees.curRoot();
                let CurrentRootNum = toBigNum(CurrentRoot.root);
                console.log("Current Root:", CurrentRootNum);
             */
        });
    });

    describe('verify proof using zero panther-core tree & solidity verifier', () => {
        before(async () => {
            snapshot = await takeSnapshot();
        });

        after(async () => {
            await revertSnapshot(snapshot);
        });

        const poseidon2or3 = (inputs: bigint[]): bigint => {
            assert(inputs.length === 3 || inputs.length === 2);
            return poseidon(inputs);
        };

        describe('FIRST TEST', function () {
            let tree: TriadMerkleTree;
            const PANTHER_CORE_ZERO_VALUE = BigInt('2896678800030780677881716886212119387589061708732637213728415628433288554509');
            const PANTHER_CORE_TREE_DEPTH_SIZE = 15;
            tree = new TriadMerkleTree(PANTHER_CORE_TREE_DEPTH_SIZE, PANTHER_CORE_ZERO_VALUE, poseidon2or3);

            const amountsOut = [BigInt('7'), BigInt('8'), BigInt('9')];
            const token: BigInt = BigInt('111');
            const createTime: BigInt = BigInt('1651062006');
            const pubKey: BigInt[] = [
                BigInt('18387562449515087847139054493296768033506512818644357279697022045358977016147'),
                BigInt('2792662591747231738854329419102915533513463924144922287150280827153219249810')
            ];
            const commitments = [
                poseidon([pubKey[0], pubKey[1], amountsOut[0], token, createTime]),
                poseidon([pubKey[0], pubKey[1], amountsOut[1], token, createTime]),
                poseidon([pubKey[0], pubKey[1], amountsOut[2], token, createTime])
            ];
            // [0] - First insert
            tree.insertBatch([BigInt(commitments[0]), BigInt(commitments[1]), BigInt(commitments[2])]);

            let merkleProof = [
                tree.genMerklePath(0),
                tree.genMerklePath(1),
                tree.genMerklePath(2)
            ];
            //console.log("Merkle Proofs for 0 leaf after first insert:", merkleProof[0]);
            //console.log("Merkle Proofs for 1 leaf after first insert:", merkleProof[1]);
            //console.log("Merkle Proofs for 2 leaf after first insert:", merkleProof[2]);

            // These values were extracted from solidity code
            const ShouldBeMerklePathElementsAfterFirstInsert = [
                BigInt('12610959546703067021829481548786041058957588484398889881477381005496514537462'),
                BigInt('3349047423219193406330965173426204517756040645871630854057691440868894250982'),
                BigInt('18389954371877325743937615564349876315640427734567075272665046346265626136419'),
                BigInt('3821922445747924499025173562938580174383118354164359337630642212084359151964'),
                BigInt('15935733969631511252102568819760944197418770481327957873988205677660925018528'),
                BigInt('11782991327328543086851214586786607762143799684091548387988272710726371549961'),
                BigInt('20296808824597379678225500535446241165197388668932210796624301020410505806483'),
                BigInt('4173461319953077503036196915980451538453535748888760632593364006273103304132'),
                BigInt('5766550159403151835612862031619173244724183903452415224168581364310081162759'),
                BigInt('10719667445803564685804016390777214089338112164281015443530526835727343022767'),
                BigInt('21349090590431709965480677812339735277896174812144673690644796244835835356674'),
                BigInt('19531707066138634990416163973328796061422245663290449768207249753220005371133'),
                BigInt('13000046769163827723557373669699328816629124803440350859991091474655812341048'),
                BigInt('8951578653298612361448433248556484464983144095284075554880538299310385645682'),
                BigInt('7870690898942382169582441685508490691047003383534923922466972436590775853570') // ROOT
            ];

            for (let i = 2; i < PANTHER_CORE_TREE_DEPTH_SIZE; i++) {
                let computed = merkleProof[0].pathElements[i][0];
                expect(BigInt(computed) == ShouldBeMerklePathElementsAfterFirstInsert[i], "Must Be Equal");
            }

            // [1] - Second insert
            tree.insertBatch([BigInt(commitments[0]), BigInt(commitments[1]), BigInt(commitments[2])]);

            let merkleProofSecondInsert = [
                tree.genMerklePath(3),
                tree.genMerklePath(4),
                tree.genMerklePath(5)
            ];

            let ShouldBeMerklePathElementsAfterSecondInsert = [
                BigInt('2036430464785539673097545458320380514076050513668437280501170446145938050826'),
                BigInt('3349047423219193406330965173426204517756040645871630854057691440868894250982'),
                BigInt('18389954371877325743937615564349876315640427734567075272665046346265626136419'),
                BigInt('3821922445747924499025173562938580174383118354164359337630642212084359151964'),
                BigInt('15935733969631511252102568819760944197418770481327957873988205677660925018528'),
                BigInt('11782991327328543086851214586786607762143799684091548387988272710726371549961'),
                BigInt('20296808824597379678225500535446241165197388668932210796624301020410505806483'),
                BigInt('4173461319953077503036196915980451538453535748888760632593364006273103304132'),
                BigInt('5766550159403151835612862031619173244724183903452415224168581364310081162759'),
                BigInt('10719667445803564685804016390777214089338112164281015443530526835727343022767'),
                BigInt('21349090590431709965480677812339735277896174812144673690644796244835835356674'),
                BigInt('19531707066138634990416163973328796061422245663290449768207249753220005371133'),
                BigInt('13000046769163827723557373669699328816629124803440350859991091474655812341048'),
                BigInt('8951578653298612361448433248556484464983144095284075554880538299310385645682'),
                BigInt('5080802032616611841695934472369605256187370514682593051886813285782187880244') // ROOT
            ];

            for (let i = 2; i < PANTHER_CORE_TREE_DEPTH_SIZE; i++) {
                let computed = merkleProofSecondInsert[0].pathElements[i][0];
                expect(BigInt(computed) == ShouldBeMerklePathElementsAfterSecondInsert[i], "Must Be Equal");
            }

            // [3] - Third insert
            tree.insertBatch([BigInt(commitments[0]), BigInt(commitments[1]), BigInt(commitments[2])]);

            let merkleProofThirdInsert = [
                tree.genMerklePath(6),
                tree.genMerklePath(7),
                tree.genMerklePath(8)
            ];

            let ShouldBeMerklePathElementsAfterThirdInsert = [
                BigInt('12610959546703067021829481548786041058957588484398889881477381005496514537462'),
                BigInt('6593769061588505652796652368972428248449904784599508005290567407050120675396'),
                BigInt('18389954371877325743937615564349876315640427734567075272665046346265626136419'),
                BigInt('3821922445747924499025173562938580174383118354164359337630642212084359151964'),
                BigInt('15935733969631511252102568819760944197418770481327957873988205677660925018528'),
                BigInt('11782991327328543086851214586786607762143799684091548387988272710726371549961'),
                BigInt('20296808824597379678225500535446241165197388668932210796624301020410505806483'),
                BigInt('4173461319953077503036196915980451538453535748888760632593364006273103304132'),
                BigInt('5766550159403151835612862031619173244724183903452415224168581364310081162759'),
                BigInt('10719667445803564685804016390777214089338112164281015443530526835727343022767'),
                BigInt('21349090590431709965480677812339735277896174812144673690644796244835835356674'),
                BigInt('19531707066138634990416163973328796061422245663290449768207249753220005371133'),
                BigInt('13000046769163827723557373669699328816629124803440350859991091474655812341048'),
                BigInt('8951578653298612361448433248556484464983144095284075554880538299310385645682'),
                BigInt('12639523502428448254562583832651707893831215707918737401127830898440049948195') // ROOT
            ];

            for (let i = 2; i < PANTHER_CORE_TREE_DEPTH_SIZE; i++) {
                let computed = merkleProofThirdInsert[0].pathElements[i][0];
                expect(BigInt(computed) == ShouldBeMerklePathElementsAfterThirdInsert[i], "Must Be Equal");
            }
            /* DONT REMOVE THIS CODE - Its used to make tests on MT solidity version
            it('should `PathElements` be equal to precomputed', async () => {
                const commitment0 = poseidon([pubKey[0], pubKey[1], amountsOut[0], token, createTime]);
                const commitment1 = poseidon([pubKey[0], pubKey[1], amountsOut[1], token, createTime]);
                const commitment2 = poseidon([pubKey[0], pubKey[1], amountsOut[2], token, createTime]);
                const c1 = toBytes32(commitment0);
                const c2 = toBytes32(commitment1);
                const c3 = toBytes32(commitment2);
                const commitmentsLeavesTriadNumber = [c1,c2,c3] as Triad;
                console.log("Commitments:", toBigNum(c1), toBigNum(c2), toBigNum(c3));
                await trees.internalInsertBatchZkp(commitmentsLeavesTriadNumber);
                let elements = await trees.PathElements();
                let index = await  trees.LeafId();
                console.log("LeafID:", index);
                for (let i = 0; i < PANTHER_CORE_TREE_DEPTH_SIZE; i++) {
                    console.log("Solidity 1 insert Path Element [", i, "]", toBigNum(elements[i]));
                }
                await trees.internalInsertBatchZkp(commitmentsLeavesTriadNumber);
                elements = await trees.PathElements();
                index = await  trees.LeafId();
                console.log("LeafID:", index);
                for (let i = 0; i < PANTHER_CORE_TREE_DEPTH_SIZE; i++) {
                    console.log("Solidity 2 insert Path Element [", i, "]", toBigNum(elements[i]));
                }
                await trees.internalInsertBatchZkp(commitmentsLeavesTriadNumber);
                elements = await trees.PathElements();
                index = await  trees.LeafId();
                console.log("LeafID:", index);
                for (let i = 0; i < PANTHER_CORE_TREE_DEPTH_SIZE; i++) {
                    console.log("Solidity 3 insert Path Element [", i, "]", toBigNum(elements[i]));
                }
            });
            */
        });
    });

});
