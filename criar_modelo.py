#!/usr/bin/env python3
"""
Cria ai_detector.onnx — regressão logística com 15 features numéricas.
Não precisa de dataset: os pesos são calibrados por conhecimento de domínio.

Features (índice → descrição):
  0  densidade de conectivos discursivos (furthermore, além disso…)
  1  densidade de frases hedge/ênfase (it is important to note…)
  2  uniformidade do comprimento das frases  (CV invertido)
  3  comprimento médio das frases (normalizado)
  4  formalidade do vocabulário (palavras longas)
  5  densidade de vírgulas (pontuação formal)
  6  capitalização perfeita (frase começa com maiúscula)
  7  ausência de marcadores informais (vc, kk, gonna…)
  8  voz passiva (is used, é considerado…)
  9  TTR baixo  (pouca diversidade = repetitivo)
 10  ausência de contrações (don't, I'm…)
 11  densidade de marcadores de lista (1., -, •)
 12  vocabulário acadêmico (utilize, framework, paradigm…)
 13  ausência de acentos faltando em PT (voce → você)
 14  comprimento × uniformidade combinados
"""

import numpy as np
import onnx
from onnx import helper, TensorProto, numpy_helper

# ── Pesos (positivo = indica IA) ──────────────────────────────────────────────
WEIGHTS = np.array([
    3.5,   #  0  conectivos discursivos
    4.2,   #  1  frases hedge / ênfase
    1.8,   #  2  uniformidade de comprimento
    1.5,   #  3  frases longas
    1.5,   #  4  vocabulário formal
    0.7,   #  5  vírgulas formais
    0.5,   #  6  capitalização
    1.8,   #  7  ausência de informalidade
    1.0,   #  8  voz passiva
    0.4,   #  9  TTR baixo
    1.8,   # 10  ausência de contrações
    0.5,   # 11  marcadores de lista
    2.2,   # 12  vocabulário acadêmico
    0.5,   # 13  sem acentos faltando
    1.5,   # 14  comprimento × uniformidade
], dtype=np.float32).reshape(15, 1)

# Bias negativo: exige evidência forte para marcar como IA (evita falsos positivos)
BIAS = np.array([-5.8], dtype=np.float32)


def build_model() -> onnx.ModelProto:
    # Entradas / saídas
    X   = helper.make_tensor_value_info('input',         TensorProto.FLOAT, [None, 15])
    out = helper.make_tensor_value_info('probabilities', TensorProto.FLOAT, [None, 2])

    w_init   = numpy_helper.from_array(WEIGHTS,                              name='W')
    b_init   = numpy_helper.from_array(BIAS,                                 name='B')
    one_init = numpy_helper.from_array(np.ones((1, 1), dtype=np.float32),    name='ONE')

    matmul  = helper.make_node('MatMul',  ['input', 'W'],        ['logit_raw'])
    add_b   = helper.make_node('Add',     ['logit_raw', 'B'],    ['logit'])
    sigmoid = helper.make_node('Sigmoid', ['logit'],             ['p_ai'])
    sub     = helper.make_node('Sub',     ['ONE', 'p_ai'],       ['p_human'])
    concat  = helper.make_node('Concat',  ['p_human', 'p_ai'],   ['probabilities'], axis=1)

    graph = helper.make_graph(
        [matmul, add_b, sigmoid, sub, concat],
        'ai_text_detector',
        [X], [out],
        initializer=[w_init, b_init, one_init],
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid('', 17)])
    model.doc_string = 'AI Text Detector v2 — feature-based logistic regression'
    onnx.checker.check_model(model)
    return model


def test_model(path: str):
    import onnxruntime as rt
    sess = rt.InferenceSession(path)

    # Texto claramente IA: muitos conectivos, hedge, frases longas e uniformes
    ai_feat = np.array([[
        0.50,  # 0  alta densidade de conectivos
        0.40,  # 1  hedges presentes
        0.80,  # 2  muito uniforme
        0.70,  # 3  frases longas
        0.65,  # 4  vocabulário formal
        0.55,  # 5  muitas vírgulas
        1.00,  # 6  capitalização perfeita
        1.00,  # 7  sem informalidade
        0.30,  # 8  alguma voz passiva
        0.35,  # 9  TTR moderado
        0.95,  # 10 sem contrações
        0.20,  # 11 alguma lista
        0.45,  # 12 vocab acadêmico
        1.00,  # 13 sem acentos faltando
        0.56,  # 14 longo × uniforme
    ]], dtype=np.float32)

    # Texto claramente humano: informal, curto, variado
    human_feat = np.array([[
        0.00,  # 0  sem conectivos
        0.00,  # 1  sem hedge
        0.25,  # 2  pouco uniforme
        0.10,  # 3  frases curtas
        0.15,  # 4  vocabulário simples
        0.10,  # 5  pouca pontuação formal
        0.60,  # 6  capitalização normal
        0.20,  # 7  com informalidade
        0.00,  # 8  sem passiva
        0.75,  # 9  TTR alto (variado)
        0.20,  # 10 com contrações
        0.00,  # 11 sem lista
        0.05,  # 12 sem vocab acadêmico
        0.60,  # 13 alguns acentos faltando
        0.03,  # 14 curto + não uniforme
    ]], dtype=np.float32)

    for label, feat in [('IA (esperado > 0.70)', ai_feat), ('Humano (esperado < 0.30)', human_feat)]:
        prob = sess.run(None, {'input': feat})[0][0]
        print(f'  {label}: prob_IA={prob[1]:.3f}  prob_humano={prob[0]:.3f}')


if __name__ == '__main__':
    model = build_model()
    path  = 'ai_detector.onnx'
    onnx.save(model, path)
    print(f'✓ Modelo salvo em {path}')
    print('\nTeste básico:')
    test_model(path)
