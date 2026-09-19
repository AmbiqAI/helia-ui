// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
namespace runtime {
/// Fixed-capacity resolver.
template <unsigned Capacity, typename Value = int>
class Resolver {
 public:
  /// The caller retains ownership of the borrowed arena.
  Resolver(unsigned char* arena, unsigned size);
  /// The caller retains ownership of the allocator.
  Resolver(void* allocator);
  /// Find an operation by numeric code.
  Value* Find(int code) const;
  /// Find an operation by name.
  Value* Find(const char* name) const;
  /// Find an operation by code and version.
  Value* Find(int code, int version) const;
  /// Return null if the tensor type differs from T.
  template <typename T>
  T* input(int index);
 private:
  void hidden();
  void input(double index);
};
/// Read a scalar value.
template <typename T = float>
T read(const T* data);
/// Callback template parameter.
template <int (*Fn)(int)>
class Callback {};
/// Array reference template parameter.
template <int (&Array)[3]>
class ArrayHolder {};
}
