const { MessageEmbed, Formatters } = require('discord.js');

const atualizarEmbedQtdProduto = (nome, qtd = 1) => (

    new MessageEmbed()
        .setTitle(`**Quantidade:** ${qtd}`)
        .setDescription(
            Formatters.codeBlock(nome)
        )
);

module.exports = { atualizarEmbedQtdProduto };
