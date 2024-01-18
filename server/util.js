/**
 * Encapsulate input by an array.
 * @param {*} input
 * @param {(null|*)} nonTruthyDefault Default value when the input is not truthy.
 * @returns {(Array|null)} Array of the input or nonTruthyDefault if the input is not truthy.
 */
const formatArray = (input, nonTruthyDefault = null) => {
    return input && Array.isArray(input) ? input : (input ? [input] : nonTruthyDefault);
}

module.exports = {
    formatArray
}