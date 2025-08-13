## Release 0.7.0

The features main features of this release are:

- Packages
- New features for fixed columns (bits, temporal)
- Virtual instantiation of AirTemplates

---

### Packages
This feature allows you to group functions within a package, which also frees up the global namespace. This functionality was added because the number of built-ins is growing.
```
package MyLibrary {
    function duplicate(int n): int {
        return n * 2;
    }
}
MyLibrary.duplicate(3);
```
Another characteristic of packages is that, by default, functions created inside are private. You can make a function public (exportable) using the `public` keyword as follows:
```
package MyLibrary {
    public function foo(int n): int {
        return dup(n) * dup(n+1);
    }
    function dup(int n): int {
        return n * 2;
    }
}
MyLibrary.foo(3);
```

Inside a package, when calling another internal function, it is not necessary to specify the package name. When resolving a reference, the compiler first searches within the current package.

Packages also support the `use` statement with aliases, using the following syntax:
```
use MyLibrary.foo as library_foo;
```

### New Features for Fixed Columns
Columns can now define additional "features" such as:
- **temporal([<num_rows>])**: This feature was previously available via a pragma, but now you can define a fixed column as temporal. This means the column is not defined in the pilout; it is only used to facilitate the generation of other tables or to transfer information between functions.
```
col fixed temporal() my_temporal_col_with_default_rows;
col fixed temporal(8000) my_temporal_col_with_8000_rows;
```
- **bits(<num_bits>[,signed|unsigned])**: This feature adds extra information to the witness about the number of bits used for its representation. **IMPORTANT**: This feature does not add any constraint; it is only **extra information** for witness computation.
```
col witness bits(1) enable;
enable * (1 - enable) === 0;

col witness bits(16) chunks[4];
col witness bits(21) carry;
```

### Virtual Instantiation


A virtual instantiation specifies that an AirTemplate instance is virtual. This means it creates a virtual AirTemplate that will **not** be included in the final `pilout`. This mechanism allows libraries (such as `std`) to access the instance information without generating output to pilout.


#### Key characteristics:

- The special variable **`VIRTUAL`** is set to `1` inside a virtual AirTemplate, and `0` otherwise.
- The **number of rows** (`N`) in a virtual AirTemplate **does not need to be a power of 2**. This is especially useful when the AirTemplate contains a table, as it allows specifying the exact number of rows without padding.
- For security reasons, a virtual AirTemplate **cannot have constraints**. If air constraints are defined inside a virtual AirTemplate, an error will be thrown.

This feature allows users to define their air tables as virtual, without needing to split or join them. Later, a library such as `std` can manage these virtual tables, combining them into a single air with a specific number of rows or other desired configurations.

Example:
```
virtual myAirTable();
```

#### Package Tables

To efficiently manage tables, the `Tables` package was created as a built-in package.
The following functions are available:
- **num_rows(col)**: Returns the number of rows of a fixed column.
    ```
    int rows = Tables.num_rows(my_fixed_col);
    ```
- **copy(src_col, src_offset, dst_col, dst_offset, count)**: Copy `<count>` rows starting from row `<src_offset>` of `<src_col>` to '<dst_offset>` from `<dst_col>`.
    ```
    Tables.copy(big_fixed_col, 0, small_fixed_col, 16, 32);
    ```
- **fill(value, dst_col, offset, count)**: Fill with value `<value>`, `<count>` rows starting from row `<offset>`.
    ```
    Tables.fill(0xFFFF, my_fixed_col, 0, 32);
    ```
- **print(col, offset, count)**: Used by debugging proposal, print `<count>` rows of `<col>` starting from row `<offset>`.
    ```
    Tables.copy(my_fixed_col, 16, 32);
    ```