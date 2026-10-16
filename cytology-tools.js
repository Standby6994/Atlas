// Educational counts for a diploid eukaryotic nuclear genome. No animation or
// prediction of biological outcomes; phases specify the unit being counted.
export function chromosomeCounts(n){
  n=Number(n);
  if(!Number.isInteger(n)||n<1||n>1000)throw new RangeError('Informe n como inteiro entre 1 e 1000.');
  const phases=[
    ['G1, antes da duplicação','2n','2C',2,2],
    ['G2, após a fase S','2n','4C',2,4],
    ['Metáfase da mitose','2n','4C',2,4],
    ['Cada célula após mitose','2n','2C',2,2],
    ['Cada célula após meiose I','n','2C',1,2],
    ['Cada célula após meiose II','n','1C',1,1]
  ];
  return phases.map(([phase,ploidy,dnaContent,chromosomeFactor,dnaFactor])=>({phase,ploidy,dnaContent,chromosomes:n*chromosomeFactor,nuclearDNAMolecules:n*dnaFactor}));
}

export function representationMagnification(imageMillimeters,objectMicrometers){
  imageMillimeters=Number(imageMillimeters);objectMicrometers=Number(objectMicrometers);
  if(!Number.isFinite(imageMillimeters)||!Number.isFinite(objectMicrometers)||imageMillimeters<=0||objectMicrometers<=0)throw new RangeError('Os dois tamanhos devem ser números positivos.');
  const magnification=imageMillimeters*1000/objectMicrometers;
  if(!Number.isFinite(magnification))throw new RangeError('Tamanhos fora da faixa de cálculo.');
  return {imageMillimeters,objectMicrometers,magnification};
}
